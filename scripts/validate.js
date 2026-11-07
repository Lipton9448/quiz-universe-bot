'use strict';
const fs = require('fs');
const path = require('path');

const BOT_LIST = require('../src/bots');
const dir = path.join(__dirname, '..', 'packs');

let errors = 0;
for (const def of BOT_LIST) {
  const file = path.join(dir, def.id + '.json');
  try {
    const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
    const problems = [];
    if (pack.key !== def.id) problems.push(`key=${pack.key}, ожидался ${def.id}`);
    if (!pack.title) problems.push('нет title');
    if (!Array.isArray(pack.ranks) || pack.ranks.length !== 5) problems.push('ranks != 5');
    for (const r of pack.ranks || []) {
      if (!r.title || !r.emoji) problems.push('битый rank');
    }
    if (!Array.isArray(pack.questions)) problems.push('нет questions');
    (pack.questions || []).forEach((q, i) => {
      if (!q.q || !q.answer) problems.push(`вопрос ${i + 1}: нет q/answer`);
      if (!Array.isArray(q.options) || q.options.length < 2) problems.push(`вопрос ${i + 1}: мало options`);
      if (q.options && !q.options.some((o) => String(o).toLowerCase() === String(q.answer).toLowerCase())) {
        problems.push(`вопрос ${i + 1}: ответ "${q.answer}" не входит в options`);
      }
      if (!q.fact) problems.push(`вопрос ${i + 1}: нет fact`);
    });
    if (problems.length) {
      errors += problems.length;
      console.log(`❌ ${def.id}:`);
      problems.forEach((p) => console.log(`   - ${p}`));
    } else {
      console.log(`✅ ${def.id} — ${pack.questions.length} вопросов`);
    }
  } catch (e) {
    errors++;
    console.log(`❌ ${def.id}: JSON не читается — ${e.message}`);
  }
}

console.log(errors ? `\nОшибок: ${errors}` : '\nВсе паки валидны 🎉');
process.exit(errors ? 1 : 0);
