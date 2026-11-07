'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'miniapp')));

const packs = require(path.join(__dirname, '..', 'packs', 'index.js'));
const storage = require(path.join(__dirname, '..', 'src', 'storage.js'));

const STATE_DIR = path.join(__dirname, '..', 'state');

app.get('/api/packs', (req, res) => {
  const out = {};
  for (const [k, p] of Object.entries(packs)) {
    out[k] = {
      key: p.key,
      title: p.title,
      emoji: p.emoji,
      tagline: p.tagline,
      questions: p.questions,
      ranks: p.ranks
    };
  }
  res.json(out);
});

app.get('/api/stats', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const cats = [];
  for (const [k, p] of Object.entries(packs)) {
    const st = storage.loadUsers({ id: userId }, k);
    const u = st.get();
    if (u.games > 0) {
      cats.push({ key: k, title: p.title, emoji: p.emoji, points: u.points || 0, games: u.games || 0, bestStreak: u.best_streak || 0 });
    }
  }
  res.json({ categories: cats });
});

app.post('/api/result', (req, res) => {
  const { userId, userName, packKey, score, bestStreak } = req.body;
  if (!userId || !packKey || !packs[packKey]) return res.status(400).json({ error: 'bad request' });
  const st = storage.loadUsers({ id: userId, first_name: userName }, packKey);
  const u = st.get();
  u.points = (u.points || 0) + (score || 0);
  u.games = (u.games || 0) + 1;
  u.best_streak = Math.max(u.best_streak || 0, bestStreak || 0);
  st.save();
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok', packs: Object.keys(packs).length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mini App server running on port ${PORT}`));
