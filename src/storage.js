'use strict';
const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', 'state');

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

  const key = String(userData.id);
  if (!users[key]) {
    users[key] = {
      id: userData.id,
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

  let dirty = false;
  const save = () => {
    dirty = false;
    fs.writeFileSync(file, JSON.stringify(users, null, 2));
  };

  return {
    get: () => users[key],
    save,
    getData: () => users,
    file
  };
}

module.exports = { loadUsers };
