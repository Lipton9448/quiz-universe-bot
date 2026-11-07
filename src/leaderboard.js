'use strict';

function getPoints(user) {
  if (!user) return 0;
  return Number(user.points) || 0;
}

function displayName(u) {
  if (!u) return 'Игрок';
  if (u.username) return '@' + u.username;
  return u.first_name || `Игрок ${u.id}`;
}

function leaderboardText(users, topN) {
  const list = Object.values(users || {})
    .filter((u) => getPoints(u) > 0)
    .sort((a, b) => getPoints(b) - getPoints(a))
    .slice(0, topN || 10);

  if (!list.length) {
    return '🏆 <b>Рейтинг пока пуст</b>\n\nСтань первым — нажми /quiz и пройди квиз!';
  }

  const medals = ['🥇', '🥈', '🥉'];
  let out = '🏆 <b>Рейтинг игроков</b>\n\n';
  list.forEach((u, i) => {
    const place = medals[i] || `${i + 1}.`;
    out += `${place} ${displayName(u)} — <b>${getPoints(u)}</b> очк.\n`;
  });
  return out.trimEnd();
}

function userPlace(user, users) {
  const sorted = Object.values(users || {})
    .filter((u) => getPoints(u) > 0)
    .sort((a, b) => getPoints(b) - getPoints(a));
  const idx = sorted.findIndex((u) => String(u.id) === String(user.id));
  return idx === -1 ? null : idx + 1;
}

module.exports = { leaderboardText, userPlace, getPoints, displayName };
