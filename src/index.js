'use strict';
const { loadEnv } = require('./env');
loadEnv();

const fs = require('fs');
const path = require('path');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN не задан в .env — см. README');
  process.exit(1);
}

const { runBot } = require('./engine');

runBot({ token, username: process.env.BOT_USERNAME })
  .catch((e) => {
    console.error('[fatal]', e.message);
    process.exit(1);
  });
