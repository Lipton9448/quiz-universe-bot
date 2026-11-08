'use strict';
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config.json');
const packs = require('../packs/index.js');
const storage = require('./storage');
const leaderboard = require('./leaderboard');
const { checkAnswer } = require('./answer-check');

const TOPN = config.defaultTopN || 10;
const POINTS = 2;
const STREAK_BONUS = 3;
const STREAK_FOR_BONUS = 3;

const sessions = new Map();
const userCategory = new Map();

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Shuffle options deterministically per question so the correct answer
// is not always in the same slot for the user.
function shuffledOptions(q, seed) {
  const opts = q.options.map((text, i) => ({ text, i }));
  let s = seed * 2654435761 % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = opts.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = opts[i];
    opts[i] = opts[j];
    opts[j] = tmp;
  }
  return opts;
}

function miniAppRow() {
  const url = process.env.MINIAPP_URL;
  if (!url) return null;
  return [{ text: '📱 Открыть Mini App', web_app: { url } }];
}

function categoriesGrid() {
  const keys = Object.keys(packs);
  const rows = [];
  for (let i = 0; i < keys.length; i += 2) {
    const row = [];
    const p1 = packs[keys[i]];
    row.push({ text: `${p1.emoji} ${p1.title}`, callback_data: `cat:${p1.key}` });
    if (keys[i + 1]) {
      const p2 = packs[keys[i + 1]];
      row.push({ text: `${p2.emoji} ${p2.title}`, callback_data: `cat:${p2.key}` });
    }
    rows.push(row);
  }
  const mrow = miniAppRow();
  if (mrow) rows.push(mrow);
  return rows;
}

function mainMenu() {
  const rows = [
    [{ text: '🎮 Выбрать квиз', callback_data: 'menu:categories' }],
    [{ text: '🏆 Рейтинг', callback_data: 'menu:top' }, { text: '📊 Моя статистика', callback_data: 'menu:stats' }]
  ];
  const mrow = miniAppRow();
  if (mrow) rows.push(mrow);
  return { reply_markup: { inline_keyboard: rows } };
}

// Reply keyboard under the message input: quick access buttons +
// a Mini App button that opens the web app straight away.
function replyKeyboard() {
  const url = process.env.MINIAPP_URL;
  const k = {
    keyboard: [
      [{ text: '📱 Mini App', web_app: { url: url || 'https://example.com' } }, { text: '🎮 Категории' }],
      [{ text: '🏆 Рейтинг' }, { text: '📊 Статистика' }],
      [{ text: '❓ Помощь' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
  if (!url) {
    k.keyboard[0] = [{ text: '🎮 Категории' }, { text: '❓ Помощь' }];
  }
  return k;
}

function send(bot, chatId, text, extra) {
  return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...(extra || {}) }).catch((e) => {
    console.error('[send]', e.message);
  });
}

function store(from, packKey) {
  return storage.loadUsers(from, packKey || 'global');
}

function getSession(chatId, userId) {
  return sessions.get(`${chatId}:${userId}`);
}

function setSession(chatId, userId, data) {
  sessions.set(`${chatId}:${userId}`, data);
}

function clearSession(chatId, userId) {
  sessions.delete(`${chatId}:${userId}`);
}

function startQuiz(bot, chatId, from, packKey) {
  const pack = packs[packKey];
  if (!pack) return;
  userCategory.set(from.id, packKey);
  const st = store(from, packKey);
  const u = st.get();
  // Случайный порядок вопросов при каждой игре: заходи чаще — каждый раз ново
  const order = pack.questions.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  setSession(chatId, from.id, {
    chatId,
    userId: from.id,
    packKey,
    order,
    index: 0,
    points: 0,
    streak: 0,
    correctCount: 0,
    bestStreak: u.best_streak || 0
  });
  send(
    bot,
    chatId,
    `${pack.emoji} <b>${esc(pack.title)}</b>\n<i>${esc(pack.tagline)}</i>\n\n` +
      `❓ Вопросов: ${pack.questions.length}\n` +
      `⭐ За верный ответ: ${POINTS} очка\n` +
      `🔥 Серия из ${STREAK_FOR_BONUS} подряд: бонус\n\n` +
      `Погнали!`,
    { reply_markup: replyKeyboard() }
  );
  setTimeout(() => askQuestion(bot, chatId, from.id), 600);
}

function askQuestion(bot, chatId, userId) {
  const s = getSession(chatId, userId);
  if (!s) return;
  const pack = packs[s.packKey];
  if (!pack) return;
  if (s.index >= s.order.length) return finish(bot, chatId, userId);

  const q = pack.questions[s.order[s.index]];
  let text = `❓ <b>Вопрос ${s.index + 1}/${s.order.length}</b>\n\n${esc(q.q)}`;
  if (s.streak >= 2) text += `\n\n🔥 Серия: ${s.streak} подряд!`;

  // Answer options are shown in random order: correct answer not always first.
  const opts = shuffledOptions(q, Math.floor(Math.random() * 1e6));
  s.currentOrder = opts;
  const buttons = opts.map((o, i) => [
    { text: o.text, callback_data: `a:${s.index}:${i}` }
  ]);
  buttons.push([{ text: '🛑 Закончить квиз', callback_data: 'quiz:stop' }]);
  send(bot, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

function pointsFor(s) {
  return s.streak >= STREAK_FOR_BONUS - 1 ? STREAK_BONUS : POINTS;
}

function finish(bot, chatId, userId) {
  const s = getSession(chatId, userId);
  if (!s) return;
  clearSession(chatId, userId);

  const pack = packs[s.packKey];
  const st = store({ id: userId }, s.packKey);
  const u = st.get();
  u.points = (u.points || 0) + s.points;
  u.games = (u.games || 0) + 1;
  u.best_streak = Math.max(u.best_streak || 0, s.bestStreak, s.streak);
  st.save();

  // Глобальный ранг по суммарным очкам (единый для бота и Mini App)
  const globalSt = store({ id: userId }, 'global');
  const g = globalSt.get();
  g.points = (g.points || 0) + s.points;
  g.games = (g.games || 0) + 1;
  g.best_streak = Math.max(g.best_streak || 0, s.bestStreak, s.streak);
  globalSt.save();

  const { rankFor, nextRank } = require('./ranks');
  const rank = rankFor(g.points || 0);
  const next = nextRank(g.points || 0);

  const max = s.order.length * STREAK_BONUS;
  const ratio = s.points / max;
  const levelEmoji =
    ratio >= 0.9 ? '🥇' :
    ratio >= 0.7 ? '🥈' :
    ratio >= 0.45 ? '🥉' : '🌱';

  const topText = leaderboard.leaderboardText(st.getData(), TOPN);
  const nextText = next
    ? `\n📈 До ранга ${next.emoji} <b>${next.title}</b>: ещё <b>${next.min - g.points}</b> очк.`
    : `\n👑 Ты на максимальном ранге!`;

  const shareText = encodeURIComponent(
    `Я набрал ${s.points} очк. в квизе «${pack.title}» ${pack.emoji} — ранг ${rank.emoji} ${rank.title}!\nПрисоединяйся: https://t.me/${process.env.BOT_USERNAME || 'bot'}`
  );

  send(
    bot,
    chatId,
    `🏁 <b>Игра окончена!</b> ${levelEmoji}\n\n` +
      `⭐ Очков за игру: <b>${s.points}</b> из ${max}\n` +
      `🎯 Верно: ${s.correctCount}/${s.order.length}\n` +
      `🔥 Лучшая серия: ${Math.max(s.bestStreak, s.streak)}\n` +
      `🏅 Твой ранг: <b>${rank.emoji} ${rank.title}</b> (всего ${g.points} очк.)` +
      nextText + `\n\n` +
      topText +
      `\n\n🎮 /quiz — сыграть ещё\n📊 /stats — статистика`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📤 Поделиться', url: `https://t.me/share/url?url=&text=${shareText}` }],
          [{ text: '🔄 Сменить категорию', callback_data: 'menu:categories' }]
        ]
      }
    }
  );
}

async function runBot(env) {
  const bot = new TelegramBot(env.token, { polling: config.polling });

  bot.on('polling_error', (err) => {
    if (process.env.QUIET !== '1') console.error('polling error:', err.code || err.message);
  });

  bot.onText(/\/start/, (msg) => {
    send(
      bot,
      msg.chat.id,
      `🧠 <b>Quiz Universe Bot</b>\n\n` +
        `Квизы по вселенным Marvel, DC и Аниме — всё в одном боте!\n\n` +
        `🎮 Выбери категорию и играй.\n` +
        `🥉🥈🥇 Уровни: Бронза → Серебро → Золото — с каждым сложнее!\n` +
        `📱 Кнопка «Mini App» под строкой ввода — быстрый доступ.`,
      { reply_markup: replyKeyboard() }
    );
  });

  bot.onText(/\/quiz/, (msg) => {
    send(bot, msg.chat.id, 'Выбери вселенную:', { reply_markup: { inline_keyboard: categoriesGrid() } });
  });

  bot.onText(/\/top/, (msg) => {
    const cat = userCategory.get(msg.from.id);
    if (cat && packs[cat]) {
      const data = store(msg.from, cat).getData();
      send(bot, msg.chat.id, `🏆 <b>${esc(packs[cat].title)}</b>\n\n${leaderboard.leaderboardText(data, TOPN)}`);
    } else {
      send(bot, msg.chat.id, 'Сначала выбери категорию через /quiz');
    }
  });

  bot.onText(/\/stats/, (msg) => {
    const cat = userCategory.get(msg.from.id);
    const globalData = store(msg.from, 'global').getData();
    let text = `📊 <b>Твоя статистика</b>\n\n`;
    if (cat && packs[cat]) {
      const u = store(msg.from, cat).get();
      const place = leaderboard.userPlace(u, store(msg.from, cat).getData());
      text += `🎮 Текущая категория: ${packs[cat].emoji} ${esc(packs[cat].title)}\n`;
      text += `⭐ Очков: ${u.points || 0}\n`;
      text += `🎯 Игр сыграно: ${u.games || 0}\n`;
      text += `🔥 Лучшая серия: ${u.best_streak || 0}\n`;
      text += `🏆 Место: ${place || '—'}\n\n`;
    }
    text += `Всего игр во всех категориях: ${Object.values(globalData).reduce((a, u) => a + (u.games || 0), 0)}`;
    send(bot, msg.chat.id, text);
  });

  bot.onText(/\/help/, (msg) => {
    send(
      bot,
      msg.chat.id,
      `❓ <b>Как играть</b>\n\n` +
        `1. /quiz — выбери вселенную\n` +
        `2. Отвечай на 12 вопросов\n` +
        `3. За правильный ответ — 2 очка, серия из 3 — бонус (+3)\n` +
        `4. В конце — твой ранг и место в рейтинге\n\n` +
        `🥉🥈🥇 Уровни: Бронза → Серебро → Золото (вопросы сложнее)\n` +
        `📱 Mini App — квадратик слева от поля ввода\n` +
        `🏆 /top — рейтинг по текущей категории\n` +
        `📊 /stats — твоя статистика`
    );
  });

  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim().toLowerCase();

    if (text === '🏆 рейтинг' || text === 'рейтинг') {
      const cat = userCategory.get(msg.from.id);
      if (cat && packs[cat]) {
        const d = store(msg.from, cat).getData();
        send(bot, chatId, `🏆 <b>${esc(packs[cat].title)}</b>\n\n${leaderboard.leaderboardText(d, TOPN)}`);
      } else {
        send(bot, chatId, 'Сначала выбери категорию через /quiz');
      }
      return;
    }

    if (text === '📊 статистика' || text === 'статистика') {
      const cat = userCategory.get(msg.from.id);
      const globalData = store(msg.from, 'global').getData();
      let out = `📊 <b>Твоя статистика</b>\n\n`;
      if (cat && packs[cat]) {
        const u = store(msg.from, cat).get();
        out += `🎮 ${packs[cat].emoji} ${esc(packs[cat].title)}\n⭐ ${u.points || 0} очк. | 🎮 ${u.games || 0} игр | 🔥 ${u.best_streak || 0}\n\n`;
      }
      out += `Всего игр: ${Object.values(globalData).reduce((a, u) => a + (u.games || 0), 0)}`;
      send(bot, chatId, out);
      return;
    }

    if (text === '🎮 категории' || text === 'категории' || text === '🎮 квиз') {
      send(bot, chatId, 'Выбери вселенную:', { reply_markup: { inline_keyboard: categoriesGrid() } });
      return;
    }

    if (text === '❓ помощь' || text === 'помощь') {
      send(
        bot,
        chatId,
        `❓ /quiz — категории\n/top — рейтинг\n/stats — статистика\n\n` +
          `🥉 Бронза → 🥈 Серебро → 🥇 Золото — с каждым уровнем сложнее!`
      );
      return;
    }

    if (text === '📱 mini app' || text === 'mini app') {
      const url = process.env.MINIAPP_URL;
      if (url) {
        send(bot, chatId, '📱 Открываю Mini App...', {
          reply_markup: { inline_keyboard: [[{ text: '📱 Открыть', web_app: { url } }]] }
        });
      }
      return;
    }
  });

  bot.on('callback_query', (cq) => {
    const chatId = cq.message.chat.id;
    const from = cq.from;
    const data = String(cq.data || '');

    if (data === 'menu:categories') {
      bot.answerCallbackQuery(cq.id).catch(() => {});
      send(bot, chatId, 'Выбери вселенную:', { reply_markup: { inline_keyboard: categoriesGrid() } });
      return;
    }

    if (data === 'menu:stats') {
      bot.answerCallbackQuery(cq.id).catch(() => {});
      const cat = userCategory.get(from.id);
      const u = store(from, cat || 'global').get();
      send(bot, chatId, `📊 Очков: ${u.points || 0} | Игр: ${u.games || 0} | Серия: ${u.best_streak || 0}`);
      return;
    }

    if (data === 'menu:top') {
      bot.answerCallbackQuery(cq.id).catch(() => {});
      const cat = userCategory.get(from.id);
      if (cat && packs[cat]) {
        const d = store(from, cat).getData();
        send(bot, chatId, `🏆 <b>${esc(packs[cat].title)}</b>\n\n${leaderboard.leaderboardText(d, TOPN)}`);
      } else {
        send(bot, chatId, 'Сначала выбери категорию через /quiz');
      }
      return;
    }

    if (data.startsWith('cat:')) {
      const packKey = data.slice(4);
      bot.answerCallbackQuery(cq.id, { text: `Загружаю ${packs[packKey].title}...` }).catch(() => {});
      startQuiz(bot, chatId, from, packKey);
      return;
    }

    if (data === 'quiz:stop') {
      bot.answerCallbackQuery(cq.id, { text: 'Останавливаю...' }).catch(() => {});
      const s = getSession(chatId, from.id);
      if (s && s.index > 0) {
        finish(bot, chatId, from.id); // сохраняем заработанные очки
      } else {
        clearSession(chatId, from.id);
        send(bot, chatId, 'Квиз прерван. Сыграть ещё — /quiz 🙂');
      }
      return;
    }

    if (data.startsWith('a:')) {
      const s = getSession(chatId, from.id);
      if (!s) {
        bot.answerCallbackQuery(cq.id, { text: 'Нажми /quiz 🙂' }).catch(() => {});
        return;
      }
      const [, idxStr, optStr] = data.split(':');
      const idx = Number(idxStr);
      const pack = packs[s.packKey];

      if (idx !== s.index) {
        bot.answerCallbackQuery(cq.id, { text: 'Этот вопрос уже позади' }).catch(() => {});
        return;
      }

      const q = pack.questions[s.index];
      const order = s.currentOrder || q.options.map((text, i) => ({ text, i }));
      const pickedEntry = order[Number(optStr)];
      const picked = pickedEntry ? pickedEntry.text : undefined;
      const correct = picked !== undefined && checkAnswer(q.answer, picked);
      const gained = correct ? pointsFor(s) : 0;

      bot.answerCallbackQuery(cq.id, { text: correct ? `✅ +${gained}` : '❌ Мимо!' }).catch(() => {});

      let text;
      if (correct) {
        s.points += gained;
        s.streak += 1;
        s.correctCount += 1;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        text = `✅ <b>Верно!</b> ${esc(picked)}\n+${gained} очк.${s.streak >= STREAK_FOR_BONUS ? ' (бонус 🔥)' : ''}\n\n💡 ${esc(q.fact)}`;
      } else {
        s.streak = 0;
        const correctEntry = order.find((o) => checkAnswer(q.answer, o.text));
        text = `❌ <b>Правильно:</b> ${esc(correctEntry ? correctEntry.text : q.answer)}\n\n💡 ${esc(q.fact)}`;
      }

      s.index += 1;
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cq.message.message_id }).catch(() => {});
      send(bot, chatId, text);
      setTimeout(() => askQuestion(bot, chatId, from.id), 700);
      return;
    }
  });

  console.log('[ok] Quiz Universe Bot запущен');
  return bot;
}

module.exports = { runBot };