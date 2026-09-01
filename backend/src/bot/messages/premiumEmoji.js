/** Shared Telegram custom emoji IDs with Unicode fallbacks. */

export const WALLET_EMOJI = {
  check: { fallback: "✅", id: "5206607081334906820" },
  card: { fallback: "💳", id: "5445353829304387411" },
  money: { fallback: "💵", id: "5197434882321567830" },
  receipt: { fallback: "🧾", id: "5444856076954520455" },
  briefcase: { fallback: "💼", id: "5445221832074483553" },
  heart: { fallback: "❤️", id: "5267102644886853973" },
  wallet: { fallback: "👛", id: "5445353829304387411" },
  plane: { fallback: "🛫", id: "5201691993775818138" },
};

/**
 * Premium custom emoji via HTML parse mode.
 * Non-premium clients render the fallback character.
 */
export function tgPremiumEmoji(fallback, emojiId) {
  return `<tg-emoji emoji-id="${emojiId}">${fallback}</tg-emoji>`;
}

export function emoji(entry) {
  return tgPremiumEmoji(entry.fallback, entry.id);
}
