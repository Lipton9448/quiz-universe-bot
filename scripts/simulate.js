'use strict';
const assert = require('assert');
const path = require('path');
const Module = require('module');

const sent = [];
const answered = [];
const edited = [];

class FakeBot {
  constructor(token, opts) {
    this.token = token;
    this.opts = opts;
    this.handlers = {};
    this.textHandlers = [];
    this.me = { username: 'test_bot' };
  }
  on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; }
  onText(re, fn) { this.textHandlers.push({ re, fn }); return this; }
  sendMessage(chatId, text, extra) { sent.push({ chatId, text, extra }); return Promise.resolve({ message_id: sent.length }); }
  editMessageReplyMarkup(markup, opts) { edited.push({ markup, opts }); return Promise.resolve(true); }
  answerCallbackQuery(id, extra) { answered.push({ id, extra }); return Promise.resolve(true); }
}

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'node-telegram-bot-api') return 'fake-telegram';
  return origResolve.call(this, request, ...rest);
};
require.cache['fake-telegram'] = {
  id: 'fake-telegram',
  filename: 'fake-telegram',
  loaded: true,
  exports: FakeBot
};

const { runBot } = require('../src/engine');
const packs = require('../packs/index.js');

const PACK = 'marvel';
const CHAT = 555;
const FROM = { id: 777, username: 'hero', first_name: 'Герой' };

function emit(bot, evt, payload) {
  for (const fn of bot.handlers[evt] || []) fn(payload);
}
function emitText(bot, text) {
  const msg = { chat: { id: CHAT }, from: FROM, text };
  for (const { re, fn } of bot.textHandlers) if (re.test(text)) fn(msg);
}

(async () => {
  const bot = await runBot({ token: 'fake', PACK_ID: PACK, username: 'test_bot' });
  assert.ok(bot instanceof FakeBot, 'бот не создан');

  sent.length = 0;
  emitText(bot, '/start');
  assert.strictEqual(sent.length, 1, 'нет приветствия');
  assert.ok(sent[0].text.includes('Marvel'), 'приветствие без названия пака');

  sent.length = 0;
  emitText(bot, '/quiz');
  assert.strictEqual(sent.length, 1, 'нет интро квиза');
  assert.ok(sent[0].extra.reply_markup, 'интро без клавиатуры');

  await new Promise((r) => setTimeout(r, 700));
  assert.strictEqual(sent.length, 2, 'нет первого вопроса');
  const q1 = sent[1];
  assert.ok(q1.extra.reply_markup.inline_keyboard.length >= 2, 'нет вариантов ответа');

  const pack = packs[PACK];
  const total = pack.questions.length;

  for (let i = 0; i < total; i++) {
    const questionMsg = sent[sent.length - 1];
    const buttons = questionMsg.extra.reply_markup.inline_keyboard;
    const correctIdx = pack.questions[i].options.findIndex(
      (o) => o.toLowerCase() === pack.questions[i].answer.toLowerCase()
    );
    const cb = {
      id: 'cb' + i,
      data: buttons[correctIdx][0].callback_data,
      message: { chat: { id: CHAT }, message_id: 100 + i },
      from: FROM
    };
    sent.length = 0;
    emit(bot, 'callback_query', cb);
    await new Promise((r) => setTimeout(r, 800));
    assert.strictEqual(answered.length, i + 1, `ответ ${i + 1} не обработан`);
    assert.ok(sent.length >= 1, `нет сообщения после ответа ${i + 1}`);
  }

  const last = sent[sent.length - 1];
  assert.ok(last.text.includes('Игра окончена'), 'нет финального экрана');
  assert.ok(last.text.includes('Ранг'), 'нет ранга в финале');
  assert.ok(last.text.includes('Рейтинг'), 'нет лидерборда в финале');

  sent.length = 0;
  emitText(bot, '/top');
  assert.ok(sent[0].text.includes('Рейтинг'), 'нет рейтинга по /top');

  sent.length = 0;
  emitText(bot, '/stats');
  assert.ok(sent[0].text.includes('статистика'), 'нет статистики');

  const fs = require('fs');
  const file = path.join(__dirname, '..', 'state', PACK + '.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(data['777'].games, 1, 'игра не записана');
  assert.ok(data['777'].points > 0, 'очки не начислены');
  fs.unlinkSync(file);

  console.log(`✅ Интеграционный тест: ${total} вопросов, ${answered.length} ответов, финал и рейтинг работают`);
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
