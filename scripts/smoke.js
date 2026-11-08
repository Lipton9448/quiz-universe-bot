'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { checkAnswer } = require('../src/answer-check');
const storage = require('../src/storage');
const leaderboard = require('../src/leaderboard');
const packs = require('../packs/index.js');

assert.strictEqual(checkAnswer('Человек-паук', 'человек паук'), true);
assert.strictEqual(checkAnswer('Тор', 'Локи'), false);
assert.strictEqual(checkAnswer('Конохагакуре', 'Коноха'), true);

const keys = Object.keys(packs);
assert.strictEqual(keys.length, 23, `ожидалось 23 паков, найдено ${keys.length}`);

// Уровни сложности должны присутствовать
for (const lvl of ['bronze', 'silver', 'gold']) {
  assert.ok(packs[lvl], `нет пака уровня ${lvl}`);
}

for (const key of keys) {
  const p = packs[key];
  assert.strictEqual(p.questions.length, 12, `${key}: вопросов ${p.questions.length}`);
  assert.strictEqual(p.ranks.length, 5, `${key}: рангов ${p.ranks.length}`);
}

const tmpKey = '__test__';
const st = storage.loadUsers({ id: 999, username: 'tester', first_name: 'Test' }, tmpKey);
const u = st.get();
u.points = 10;
u.games = 1;
st.save();

const reloaded = storage.loadUsers({ id: 999 }, tmpKey);
assert.strictEqual(reloaded.get().points, 10, 'очки не сохранились');
assert.strictEqual(reloaded.get().username, 'tester', 'username потерялся');

const data = reloaded.getData();
const board = leaderboard.leaderboardText(data, 10);
assert.ok(board.includes('tester'), 'лидерборд не содержит игрока');
assert.strictEqual(leaderboard.userPlace(reloaded.get(), data), 1);

fs.unlinkSync(reloaded.file);
try { fs.rmdirSync(path.join(__dirname, '..', 'state')); } catch (e) {}

console.log('✅ Smoke-тест пройден: 23 пака, ответы, хранилище, рейтинг');