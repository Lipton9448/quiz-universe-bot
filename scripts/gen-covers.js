'use strict';
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Уникальная палитра для каждой вселенной + крупный эмодзи-символ
const covers = {
  marvel: { grad: ['#e23636', '#7f1d1d'], emoji: '\u{1F577}\uFE0F' },
  mcu: { grad: ['#f59e0b', '#7c2d12'], emoji: '\u{1F3AC}' },
  dc: { grad: ['#2563eb', '#1e3a8a'], emoji: '\u{1F987}' },
  anime: { grad: ['#ec4899', '#831843'], emoji: '\u{1F338}' },
  naruto: { grad: ['#f97316', '#c2410c'], emoji: '\u{1F365}' },
  onepiece: { grad: ['#0ea5e9', '#0c4a6e'], emoji: '\u{1F3F4}\u200D\u2620\uFE0F' },
  aot: { grad: ['#84cc16', '#3f6212'], emoji: '\u2694\uFE0F' },
  demonslayer: { grad: ['#22c55e', '#14532d'], emoji: '\u{1F5E1}\uFE0F' },
  dragonball: { grad: ['#fbbf24', '#b45309'], emoji: '\u{1F409}' },
  tokyoghoul: { grad: ['#dc2626', '#450a0a'], emoji: '\u{1F480}' },
  mha: { grad: ['#06b6d4', '#155e75'], emoji: '\u{1F4A5}' },
  deathnote: { grad: ['#6b7280', '#1f2937'], emoji: '\u{1F4D3}' },
  jjk: { grad: ['#8b5cf6', '#4c1d95'], emoji: '\u{1FAF1}' },
  hxh: { grad: ['#10b981', '#064e3b'], emoji: '\u{1F9ED}' },
  chainsawman: { grad: ['#ef4444', '#7f1d1d'], emoji: '\u{1FA9A}' },
  pokemon: { grad: ['#facc15', '#a16207'], emoji: '\u26A1' },
  starwars: { grad: ['#3b82f6', '#111827'], emoji: '\u{1F30C}' },
  harrypotter: { grad: ['#7c3aed', '#2e1065'], emoji: '\u26A1' },
  lotr: { grad: ['#d97706', '#78350f'], emoji: '\u{1F48D}' },
  squidgame: { grad: ['#e11d48', '#500724'], emoji: '\u{1F991}' }
};

function svgFor(c) {
  const [a, b] = c.grad;
  return `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='280' viewBox='0 0 480 280'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${a}'/><stop offset='100%' stop-color='${b}'/>
    </linearGradient>
  </defs>
  <rect width='480' height='280' fill='url(#g)'/>
  <g opacity='0.14' fill='white'>
    <circle cx='60' cy='50' r='3'/><circle cx='420' cy='40' r='2'/>
    <circle cx='380' cy='220' r='3'/><circle cx='90' cy='230' r='2'/>
    <circle cx='240' cy='30' r='2.5'/>
  </g>
  <g opacity='0.10' fill='white'>
    <path d='M0 280 L480 40 L480 80 L0 280z'/>
    <path d='M0 200 L480 0 L480 30 L0 240z'/>
  </g>
  <text x='240' y='190' font-size='130' text-anchor='middle' opacity='0.95'>${c.emoji}</text>
</svg>`;
}

(async () => {
  const dir = path.join(__dirname, '..', 'miniapp-static', 'covers');
  fs.mkdirSync(dir, { recursive: true });
  for (const [key, c] of Object.entries(covers)) {
    await sharp(Buffer.from(svgFor(c)))
      .jpeg({ quality: 88 })
      .toFile(path.join(dir, `${key}.jpg`));
  }
  console.log('covers generated:', Object.keys(covers).length);
})();