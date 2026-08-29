const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%&*?";

function pickRandom(pool, count) {
  const chars = [];

  for (let i = 0; i < count; i += 1) {
    chars.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return chars;
}

function shuffle(values) {
  const items = [...values];

  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

export function generatePanelTrialPassword() {
  return shuffle([
    ...pickRandom(LOWER, 5),
    ...pickRandom(UPPER, 5),
    ...pickRandom(DIGITS, 4),
    ...pickRandom(SPECIAL, 2),
  ]).join("");
}
