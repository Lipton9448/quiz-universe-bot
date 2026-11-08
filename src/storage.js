'use strict';
// Гибридное хранилище: локальные файлы (быстро) + GitHub как постоянный бэкап.
// Render Free стирает state/ при каждом деплое, поэтому после каждой игры
// стейт коммитится в отдельную ветку, а при старте — восстанавливается.

const fs = require('fs');
const path = require('path');
const https = require('https');

const STATE_DIR = path.join(__dirname, '..', 'state');

const GH = {
  token: process.env.GH_TOKEN || '',
  owner: process.env.GH_OWNER || 'Lipton9448',
  repo: process.env.GH_REPO || 'quiz-universe-bot',
  branch: process.env.GH_STATE_BRANCH || 'state',
  enabled: false
};

function ghReq(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'User-Agent': 'quiz-universe-bot',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${GH.token}`,
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {})
      }
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { resolve({}); }
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${buf.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function b64(obj) {
  return Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2), 'utf8').toString('base64');
}

function unb64(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

async function ensureBranch() {
  try {
    await ghReq('GET', `/repos/${GH.owner}/${GH.repo}/branches/${GH.branch}`);
  } catch (e) {
    // ветки нет — создаём от main
    const main = await ghReq('GET', `/repos/${GH.owner}/${GH.repo}/branches/main`);
    await ghReq('POST', `/repos/${GH.owner}/${GH.repo}/git/refs`, {
      ref: `refs/heads/${GH.branch}`,
      sha: main.commit.sha
    });
    console.log(`[state] branch ${GH.branch} created`);
  }
}

async function pullState() {
  if (!GH.enabled) return;
  try {
    const res = await ghReq('GET', `/repos/${GH.owner}/${GH.repo}/contents/state?ref=${GH.branch}`);
    for (const item of Array.isArray(res) ? res : []) {
      if (!item.name.endsWith('.json')) continue;
      const target = path.join(STATE_DIR, item.name);
      const remote = unb64(item.content);
      fs.writeFileSync(target, remote, 'utf8');
      console.log(`[state] restored ${item.name} from GitHub`);
    }
  } catch (e) {
    console.error('[state] pull failed:', e.message);
  }
}

async function pushState() {
  if (!GH.enabled) return;
  try {
    const files = fs.existsSync(STATE_DIR) ? fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.json')) : [];
    for (const name of files) {
      const local = fs.readFileSync(path.join(STATE_DIR, name), 'utf8');
      let sha;
      try {
        const meta = await ghReq('GET', `/repos/${GH.owner}/${GH.repo}/contents/state/${name}?ref=${GH.branch}`);
        sha = meta.sha;
        if (unb64(meta.content) === local) continue;
      } catch (e) {
        sha = undefined;
      }
      await ghReq('PUT', `/repos/${GH.owner}/${GH.repo}/contents/state/${name}`, {
        message: `state: ${name}`,
        content: b64(local),
        branch: GH.branch,
        ...(sha ? { sha } : {})
      });
    }
  } catch (e) {
    console.error('[state] push failed:', e.message);
  }
}

function stateFile(packKey) {
  return path.join(STATE_DIR, `${packKey || 'default'}.json`);
}

function loadUsers(userData, packKey) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  const file = stateFile(packKey);

  let users = {};
  try {
    users = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch (e) {
    users = {};
  }

  const key = String(userData.id || 0);
  if (!users[key]) {
    users[key] = {
      id: userData.id || 0,
      username: userData.username || '',
      first_name: userData.first_name || '',
      points: 0,
      games: 0,
      best_streak: 0
    };
  } else {
    if (userData.username) users[key].username = userData.username;
    if (userData.first_name) users[key].first_name = userData.first_name;
  }

  let saveTimer = null;
  const save = () => {
    fs.writeFileSync(file, JSON.stringify(users, null, 2));
    if (GH.enabled) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(pushState, 30 * 1000);
    }
  };

  return {
    get: () => users[key],
    save,
    getData: () => users,
    file
  };
}

function initGithub() {
  if (!GH.token) {
    console.log('[state] GH_TOKEN отсутствует — статистика только локально (сбрасывается при деплое)');
    return;
  }
  GH.enabled = true;
  console.log(`[state] GitHub storage: ${GH.owner}/${GH.repo}@${GH.branch}`);
}

module.exports = { loadUsers, pullState, pushState, ensureBranch, initGithub, GH };