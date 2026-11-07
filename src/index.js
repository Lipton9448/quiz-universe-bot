'use strict';
const { loadEnv } = require('./env');
loadEnv();

const http = require('http');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN не задан в .env — см. README');
  process.exit(1);
}

// Minimal HTTP server for platforms that require a bound port (polling bot has no inbound server).
const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Quiz Universe Bot is running');
  })
  .listen(port, () => console.log(`[http] health server on :${port}`));

const { runBot } = require('./engine');

runBot({ token, username: process.env.BOT_USERNAME })
  .catch((e) => {
    console.error('[fatal]', e.message);
    process.exit(1);
  });
