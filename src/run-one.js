'use strict';
// Запуск одного или нескольких ботов:
//   node src/run-one.js marvel
//   node src/run-one.js marvel,dc,anime
const { loadEnv } = require('./env');
loadEnv();

const arg = process.argv.slice(2).join(',');
if (!arg) {
  console.error('Укажи id пака: node src/run-one.js marvel');
  console.error('Доступные: см. src/bots.js');
  process.exit(1);
}

process.env.ONLY_BOTS = arg;
require('./index.js');
