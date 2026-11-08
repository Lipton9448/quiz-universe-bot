'use strict';
const { loadEnv } = require('./env');
loadEnv();

const http = require('http');
const { createServer } = require('./api');
const storage = require('./storage');

storage.initGithub();
storage.pullState().then(() => {
  const port = process.env.PORT || 3000;
  createServer().listen(port, () => console.log(`[http] api server on :${port}`));

  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('❌ BOT_TOKEN не задан в .env — см. README');
    process.exit(1);
  }

  const { runBot } = require('./engine');
  runBot({ token, username: process.env.BOT_USERNAME }).catch((e) => {
    console.error('[fatal]', e.message);
    process.exit(1);
  });

  // Регулярный бэкап стейта в GitHub (каждые 15 мин, на случай незакоммиченных изменений)
  setInterval(() => storage.pushState(), 15 * 60 * 1000);
});