'use strict';
// HTTP API для Mini App + health — единая статистика бот = Mini App.

const http = require('http');
const packs = require('../packs/index.js');
const storage = require('./storage');
const leaderboard = require('./leaderboard');
const { rankFor, nextRank } = require('./ranks');

const TOPN = 10;

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(buf)); } catch (e) { resolve(null); }
    });
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { json(res, 200, {}); return; }

    if (req.url === '/health') { json(res, 200, { status: 'ok' }); return; }

    if (req.url.startsWith('/api/stats')) {
      const url = new URL(req.url, 'http://x');
      const userId = url.searchParams.get('userId');
      if (!userId) { json(res, 400, { error: 'userId required' }); return; }
      const categories = [];
      let totalGames = 0, totalPoints = 0, bestStreak = 0;
      for (const [k, p] of Object.entries(packs)) {
        const st = storage.loadUsers({ id: userId }, k);
        const u = st.get();
        if (u && (u.games > 0 || u.points > 0)) {
          categories.push({
            key: k, title: p.title, emoji: p.emoji,
            points: u.points || 0, games: u.games || 0, best_streak: u.best_streak || 0
          });
          totalGames += u.games || 0;
          totalPoints += u.points || 0;
          bestStreak = Math.max(bestStreak, u.best_streak || 0);
        }
      }
      const g = storage.loadUsers({ id: userId }, 'global').get() || {};
      const rank = rankFor(g.points || totalPoints || 0);
      const next = nextRank(g.points || totalPoints || 0);
      json(res, 200, {
        userId: Number(userId),
        total: { points: g.points || 0, games: g.games || 0, best_streak: g.best_streak || bestStreak || 0 },
        rank: { title: rank.title, emoji: rank.emoji, key: rank.key },
        next_rank: next ? { title: next.title, emoji: next.emoji, need: next.min - (g.points || 0) } : null,
        categories,
        place: (() => {
          const data = storage.loadUsers({ id: userId }, 'global').getData();
          return leaderboard.userPlace(g, data);
        })()
      });
      return;
    }

    if (req.url.startsWith('/api/top')) {
      const url = new URL(req.url, 'http://x');
      const packKey = url.searchParams.get('pack') || 'global';
      const st = storage.loadUsers({ id: 0 }, packKey);
      const data = st.getData();
      const list = Object.values(data)
        .filter((u) => (u.points || 0) > 0)
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, TOPN)
        .map((u, i) => ({
          place: i + 1,
          name: leaderboard.displayName(u),
          points: u.points || 0,
          games: u.games || 0
        }));
      json(res, 200, { pack: packKey, list });
      return;
    }

    if (req.url === '/api/result' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || !body.userId || !body.packKey) { json(res, 400, { error: 'bad request' }); return; }
      if (!packs[body.packKey]) { json(res, 404, { error: 'unknown pack' }); return; }

      const src = { id: body.userId, username: body.username || '', first_name: body.userName || '' };

      const st = storage.loadUsers(src, body.packKey);
      const u = st.get();
      u.points = (u.points || 0) + (body.score || 0);
      u.games = (u.games || 0) + 1;
      u.best_streak = Math.max(u.best_streak || 0, body.bestStreak || 0);
      st.save();

      const globalSt = storage.loadUsers(src, 'global');
      const g = globalSt.get();
      g.points = (g.points || 0) + (body.score || 0);
      g.games = (g.games || 0) + 1;
      g.best_streak = Math.max(g.best_streak || 0, body.bestStreak || 0);
      globalSt.save();

      const rank = rankFor(g.points || 0);
      const next = nextRank(g.points || 0);
      json(res, 200, {
        ok: true,
        total_points: g.points,
        rank: { title: rank.title, emoji: rank.emoji },
        next_rank: next ? { title: next.title, emoji: next.emoji, need: next.min - g.points } : null
      });
      return;
    }

    json(res, 404, { error: 'not found' });
  });
}

module.exports = { createServer };