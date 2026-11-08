'use strict';
// Генерирует ВСЕ-ВОПРОСЫ.md: полный список вопросов/вариантов/ответов
// со сквозной нумерацией по всем 20 пакам (номер не сбрасывается между квизами).

const fs = require('fs');
const path = require('path');

const packs = require('../packs/index.js');

let n = 0;
const lines = ['# 📋 Все вопросы Quiz Universe Bot', '', ''];
for (const [key, p] of Object.entries(packs)) {
  lines.push(`## ${p.emoji} ${p.title} (${p.key})`);
  lines.push('');
  p.questions.forEach((q) => {
    n += 1;
    lines.push(`**${n}. ${q.q}**`);
    q.options.forEach((o, i) => lines.push(`   ${String.fromCharCode(1040 + i)}. ${o}`));
    lines.push(`   ✅ Ответ: ${q.answer}`);
    lines.push(`   💡 ${q.fact}`);
    lines.push('');
  });
}

fs.writeFileSync(path.join(__dirname, '..', 'ВСЕ-ВОПРОСЫ.md'), lines.join('\n'), 'utf8');
console.log(`Написано вопросов: ${n} -> ВСЕ-ВОПРОСЫ.md`);