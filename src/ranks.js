'use strict';
// Пороговые ранги по суммарным очкам (global). Старт — Бронза.
// И боту, и Mini App нужен один и тот же список.

const RANKS = [
  { key: 'bronze',   title: 'Бронза',   emoji: '🥉', min: 0 },
  { key: 'silver',   title: 'Серебро',  emoji: '🥈', min: 60 },
  { key: 'gold',     title: 'Золото',   emoji: '🥇', min: 150 },
  { key: 'platinum', title: 'Платина',  emoji: '🏅', min: 300 },
  { key: 'master',   title: 'Мастер',   emoji: '💎', min: 600 },
  { key: 'legend',   title: 'Легенда',  emoji: '👑', min: 1200 }
];

function rankFor(points) {
  let r = RANKS[0];
  for (const x of RANKS) if (points >= x.min) r = x;
  return r;
}

function nextRank(points) {
  for (const x of RANKS) if (points < x.min) return x;
  return null;
}

module.exports = { RANKS, rankFor, nextRank };