'use strict';
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config.json');
const packs = require('../packs/index.js');
const storage = require('./storage');
const leaderboard = require('./leaderboard');
const { checkAnswer } = require('./answer-check');
const { rankFor, nextRank, orderedForRank } = require('./ranks');

const TOPN = config.defaultTopN || 10;
const POINTS = 2;
const STREAK_BONUS = 3;
const STREAK_FOR_BONUS = 3;

const sessions = new Map();
const userCategory = new Map();

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Ответы перемешиваются каждый раз заново: правильный не на первом месте.
function shuffledOptions(q) {
  const opts = q.options.map((text) => ({ text }));
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
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
  if (!url) k.keyboard[0] = [{ text: '🎮 Категории' }, { text: '❓ Помощь' }];
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

// Ранг по общим (глобальным) очкам игрока — единый для бота и Mini App.
function startQuiz(bot, chatId, from, packKey) {
  const pack = packs[packKey];
  if (!pack) return;
  userCategory.set(from.id, packKey);
  const g = store(from, 'global').get();
  const u = store(from, packKey).get();

  // Порядок вопросов зависит от глобального ранга: Бронза — легче, Легенда — только сложные
  const plan = orderedForRank(pack.questions, g.points || 0);

  setSession(chatId, from.id, {
    chatId,
    userId: from.id,
    packKey,
    plan,
    index: 0,
    points: 0,
    streak: 0,
    correctCount: 0,
    bestStreak: u.best_streak || 0
  });

  const rank = rankFor(g.points || 0);
  send(
    bot,
    chatId,
    `${pack.emoji} <b>${esc(pack.title)}</b>\n<i>${esc(pack.tagline)}</i>\n\n` +
      `❓ Вопросов: ${plan.length}\n` +
      `🎖️ Ранг ${rank.emoji} ${rank.title} → подбор сложности по нему\n` +
      `⭐ Верные: ${POINTS} очка · 🔥 серия 3+: бонус\n\nПогнали!`,
    { reply_markup: replyKeyboard() }
  );
  setTimeout(() => askQuestion(bot, chatId, from.id), 600);
}

function askQuestion(bot, chatId, userId) {
  const s = getSession(chatId, userId);
  if (!s) return;
  if (s.index >= s.plan.length) return finish(bot, chatId, userId);

  const q = s.plan[s.index].q;
  let text = `❓ <b>Вопрос ${s.index + 1}/${s.plan.length}</b>\n\n${esc(q.q)}`;
  if (s.streak >= 2) text += `\n\n🔥 Серия: ${s.streak} подряд!`;

  const opts = shuffledOptions(q);
  s.currentOrder = opts;
  const buttons = opts.map((o, i) => [{ text: o.text, callback_data: `a:${s.index}:${i}` }]);
  buttons.push([{ text: '🛑 Закончить квиз', callback_data: 'quiz:stop' }]);
  send(bot, chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

function pointsFor(s) {
  return s.streak >= STREAK_FOR_BONUS - 1 ? STREAK_BONUS : POINTS;
}

// Финал: очки пишутся и в категорию, и в global (главный счётчик ранга). Рейтинг по global.
function finish(bot, chatId, userId) {
  const s = getSession(chatId, userId);
  if (!s) return;
  clearSession(chatId, userId);

  const pack = packs[s.packKey];
  const src = { id: userId, username: '', first_name: '' };

  const st = store(src, s.packKey);
  const u = st.get();
  u.points = (u.points || 0) + s.points;
  u.games = (u.games || 0) + 1;
  u.best_streak = Math.max(u.best_streak || 0, s.bestStreak, s.streak);
  st.save();

  const globalSt = store(src, 'global');
  const g = globalSt.get();
  g.points = (g.points || 0) + s.points;
  g.games = (g.games || 0) + 1;
  g.best_streak = Math.max(g.best_streak || 0, s.bestStreak, s.streak);
  globalSt.save();

  const rank = rankFor(g.points || 0);
  const next = nextRank(g.points || 0);
  const nextText = next
    ? `\n📈 До ${next.emoji} <b>${next.title}</b>: ещё <b>${next.min - g.points}</b> очк.${next.min - g.points <= 15 ? ' — уже близко! Жми /quiz' : ''}`
    : `\n👑 Максимальный ранг!`;

  const max = s.plan.length * STREAK_BONUS;
  const ratio = s.points / max;
  const levelEmoji = ratio >= 0.9 ? '🥇' : ratio >= 0.7 ? '🥈' : ratio >= 0.45 ? '🥉' : '🌱';

  const globalData = globalSt.getData();
  const place = leaderboard.userPlace(g, globalData);
  const topText = leaderboard.leaderboardText(globalData, TOPN);

  const shareText = encodeURIComponent(
    `Я набрал ${s.points} очк. в «${pack.title}» ${pack.emoji} — ранг ${rank.emoji} ${rank.title}!\nПрисоединяйся: https://t.me/${process.env.BOT_USERNAME || 'bot'}`
  );

  send(
    bot,
    chatId,
    `🏁 <b>Игра окончена!</b> ${levelEmoji}\n\n` +
      `⭐ За игру: <b>${s.points}</b> из ${max}\n` +
      `🎯 Верно: ${s.correctCount}/${s.plan.length}\n` +
      `🔥 Лучшая серия: ${Math.max(s.bestStreak, s.streak)}\n` +
      `🏅 Ранг: <b>${rank.emoji} ${rank.title}</b>${place ? ` · место #${place} в общем рейтинге` : ''}` +
      nextText + `\n\n` + topText +
      `\n\n🎮 /quiz — сыграть ещё`,
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
        `Квизы по Marvel, аниме, POTTER и другим вселенным — всё в одном!\n\n` +
        `🎖️ Ранг по общим очкам: 🥉 → 🥈 → 🥇 → 🏅 → 💎 → 👑\n` +
        `Чем выше ранг — тем сложнее вопросы (лёгкие уходят).\n` +
        `🏆 Рейтинг общий, не сбрасывается от смены квиза.\n` +
        `📱 Кнопка «Mini App» под строкой ввода.`,
      { reply_markup: replyKeyboard() }
    );
  });

  bot.onText(/\/quiz/, (msg) => {
    send(bot, msg.chat.id, 'Выбери вселенную:', { reply_markup: { inline_keyboard: categoriesGrid() } });
  });

  bot.onText(/\/top/, (msg) => {
    // Рейтинг всегда глобальный
    const data = store(msg.from, 'global').getData();
    const g = store(msg.from, 'global').get();
    const rank = rankFor(g.points || 0);
    const place = leaderboard.userPlace(g, data);
    send(
      bot,
      msg.chat.id,
      `🏆 <b>Общий рейтинг</b>\n` +
        `Ты: ${rank.emoji} ${rank.title}${place ? ` · место #${place}` : ''}\n\n` +
        leaderboard.leaderboardText(data, TOPN)
    );
  });

  bot.onText(/\/stats/, (msg) => {
    const from = msg.from;
    const g = store(from, 'global').get();
    const globalData = store(from, 'global').getData();
    const rank = rankFor(g.points || 0);
    const next = nextRank(g.points || 0);
    const place = leaderboard.userPlace(g, globalData);

    let text = `📊 <b>Твоя статистика</b>\n\n` +
      `🏅 Ранг: ${rank.emoji} <b>${rank.title}</b>\n` +
      `⭐ Очков всего: ${g.points || 0}\n` +
      `🎮 Игр: ${g.games || 0}\n` +
      `🔥 Лучшая серия: ${g.best_streak || 0}\n` +
      `🏆 Место в рейтинге: ${place ? '#' + place : '—'}\n`;
    if (next) text += `📈 До ${next.emoji} ${next.title}: ${next.min - (g.points || 0)} очк.\n`;

    // Разбивка по категориям
    let any = false;
    const rows = [];
    for (const [k, p] of Object.entries(packs)) {
      const c = store(from, k).get();
      if (c && (c.games > 0 || c.points > 0)) {
        any = true;
        rows.push(`${p.emoji} ${esc(p.title)}: <b>${c.points}</b> очк. · ${c.games} игр`);
      }
    }
    if (any) text += `\n<b>По категориям:</b>\n` + rows.join('\n');

    send(bot, msg.chat.id, text);
  });

  bot.onText(/\/help/, (msg) => {
    send(
      bot,
      msg.chat.id,
      `❓ <b>Как играть</b>\n\n` +
        `1. /quiz — выбери вселенную (12 вопросов)\n` +
        `2. Верный ответ: +2 очка, серия 3 подряд: +3\n` +
        `3. Очки суммируются в общий ранг\n\n` +
        `🎖️ <b>Ранги</b>\n🥉 Бронза 0 · 🥈 Серебро 60 · 🥇 Золото 150\n🏅 Платина 300 · 💎 Мастер 600 · 👑 Легенда 1200\n\n` +
        `Чем выше ранг — тем сложнее вопросы: лёгкие исчезают, сложные приходят чаще.\n` +
        `🏆 /top — общий рейтинг (с тегами игроков)\n` +
        `📊 /stats — твоя статистика по рангу и категориям\n` +
        `🛑 Кнопка «Закончить квиз» под каждым вопросом — очки сохранятся.`
    );
  });

  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim().toLowerCase();

    if (text.includes('рейтинг')) {
      const data = store(msg.from, 'global').getData();
      const g = store(msg.from, 'global').get();
      const rank = rankFor(g.points || 0);
      send(bot, chatId, `🏆 <b>Общий рейтинг</b>\nТы: ${rank.emoji} ${rank.title}\n\n${leaderboard.leaderboardText(data, TOPN)}`);
      return;
    }

    if (text.includes('статистика')) {
      const g = store(msg.from, 'global').get();
      const rank = rankFor(g.points || 0);
      send(bot, chatId, `📊 ${rank.emoji} <b>${rank.title}</b> · ⭐ ${g.points || 0} очк. · 🎮 ${g.games || 0} игр · 🔥 ${g.best_streak || 0}`);
      return;
    }

    if (text.includes('категории')) {
      send(bot, chatId, 'Выбери вселенную:', { reply_markup: { inline_keyboard: categoriesGrid() } });
      return;
    }

    if (text.includes('помощь')) {
      send(
        bot,
        chatId,
        `❓ /quiz — категории · /top — рейтинг · /stats — статистика\n\n` +
          `🎖️ Ранги: 🥉 0 → 🥈 60 → 🥇 150 → 🏅 300 → 💎 600 → 👑 1200`
      );
      return;
    }

    if (text.includes('mini app')) {
      const url = process.env.MINIAPP_URL;
      if (url) {
        send(bot, chatId, '📱 Открываю...', {
          reply_markup: { inline_keyboard: [[{ text: '📱 Открыть', web_app: { url } }]] }
        });
      }
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
      const g = store(from, 'global').get();
      const rank = rankFor(g.points || 0);
      send(bot, chatId, `📊 ${rank.emoji} ${rank.title} · ⭐ ${g.points || 0} очк. · 🎮 ${g.games || 0} игр · 🔥 ${g.best_streak || 0}`);
      return;
    }

    if (data === 'menu:top') {
      bot.answerCallbackQuery(cq.id).catch(() => {});
      const data = store(from, 'global').getData();
      const g = store(from, 'global').get();
      const rank = rankFor(g.points || 0);
      send(bot, chatId, `🏆 <b>Общий рейтинг</b>\nТы: ${rank.emoji} ${rank.title}\n\n${leaderboard.leaderboardText(data, TOPN)}`);
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
        finish(bot, chatId, from.id);
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

      if (idx !== s.index) {
        bot.answerCallbackQuery(cq.id, { text: 'Этот вопрос уже позади' }).catch(() => {});
        return;
      }

      const q = s.plan[s.index].q;
      const order = s.currentOrder || q.options.map((t) => ({ text: t }));
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