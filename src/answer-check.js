'use strict';

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s\-_—–.,!?()"'«»]/g, '')
    .trim();
}

function checkAnswer(correct, picked) {
  const c = normalize(correct);
  const p = normalize(picked);
  if (!c || !p) return false;
  if (p === c) return true;
  if (c.length >= 6 && p.length >= 4 && (c.startsWith(p) || p.startsWith(c))) return true;
  return false;
}

module.exports = { checkAnswer, normalize };
