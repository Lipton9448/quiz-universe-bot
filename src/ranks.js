'use strict';

// Сложность по рангу: чем выше общий ранг игрока, тем позже в игре就开始
// встречаться базовые ("лёгкие") вопросы и тем раньше сложные.
// Каждому вопросу пака можно задать "difficulty": 1 (лёгкий) | 2 (средний) | 3 (сложный).
// Если не задан — считается по позиции: каждая 4-я — сложнее.

const RANKS = [
  { key: 'bronze',   title: 'Бронза',   emoji: '🥉', min: 0,   dMix: [0.85, 1.0, 1.0] },
  { key: 'silver',   title: 'Серебро',  emoji: '🥈', min: 60,  dMix: [0.65, 1.0, 1.35] },
  { key: 'gold',     title: 'Золото',   emoji: '🥇', min: 150, dMix: [0.45, 1.0, 1.7] },
  { key: 'platinum', title: 'Платина',  emoji: '🏅', min: 300, dMix: [0.25, 1.0, 2.0] },
  { key: 'master',   title: 'Мастер',   emoji: '💎', min: 600, dMix: [0.1, 1.0, 2.3] },
  { key: 'legend',   title: 'Легенда',  emoji: '👑', min: 1200, dMix: [0, 1.0, 2.6] }
];

// dMix: [множитель веса лёгких, средних, сложных]. Полностью убирает лёгкие на топ-рангах.

function rankFor(points) {
  let r = RANKS[0];
  for (const x of RANKS) if (points >= x.min) r = x;
  return r;
}

function nextRank(points) {
  for (const x of RANKS) if (points < x.min) return x;
  return null;
}

function questionDifficulty(q, index) {
  if (q.difficulty === 1 || q.difficulty === 2 || q.difficulty === 3) return q.difficulty;
  return (index > 0 && (index + 1) % 4 === 0) ? 3 : ((index + 1) % 2 === 0 ? 2 : 1);
}

// Сортировка вопросов под ранг: тасуем, потом взвешиваем к нужному профилю.
// Простая эвристика: сначала идёт перемешанный порядок со сдвигом сложных вперёд на топ-рангах.
function orderedForRank(questions, points) {
  const rank = rankFor(points);
  const idx = RANKS.indexOf(rank);
  const effort = idx / (RANKS.length - 1); // 0..1

  const arr = questions.map((q, i) => ({ q, i, d: questionDifficulty(q, i) }));
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (effort > 0.3) {
    // чем выше ранг, тем больше сложных в первой половине
    const half = Math.ceil(arr.length / 2);
    const halfArr = arr.slice(0, half);
    const rest = arr.slice(half);
    halfArr.sort((a, b) => (b.d - a.d) * (effort > 0.7 ? 1 : 0.4));
    return halfArr.concat(rest).map((x) => ({ q: x.q, diff: x.d }));
  }
  return arr.map((x) => ({ q: x.q, diff: x.d }));
}

module.exports = { RANKS, rankFor, nextRank, questionDifficulty, orderedForRank };