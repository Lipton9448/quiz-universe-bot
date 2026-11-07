'use strict';
const path = require('path');
const fs = require('fs');

const dir = __dirname;
const packs = {};

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  packs[p.key] = p;
}

module.exports = packs;
