export const PAYMENT_INVOICE_EMOJI = {
  pen: { fallback: '✍️', id: '5197269100878907942' },
  card: { fallback: '💳', id: '5445353829304387411' },
  money: { fallback: '💵', id: '5197434882321567830' },
  receipt: { fallback: '🧾', id: '5444856076954520455' },
  briefcase: { fallback: '💼', id: '5445221832074483553' },
} as const

export const PAYMENT_SUCCESS_EMOJI = {
  check: { fallback: '✔️', id: '5206607081334906820' },
  briefcase: { fallback: '💼', id: '5445221832074483553' },
  plane: { fallback: '🛫', id: '5201691993775818138' },
  receipt: { fallback: '🧾', id: '5444856076954520455' },
  heart: { fallback: '❤️', id: '5267102644886853973' },
  game: { fallback: '🎮', id: '5361741454685256344' },
} as const

export const PAYMENT_FAILED_EMOJI = {
  cross: { fallback: '❌', id: '5210952531676504517' },
} as const

export const TRANSFER_SUCCESS_EMOJI = {
  briefcase: { fallback: '💼', id: '5445221832074483553' },
  eyes: { fallback: '👀', id: '5210956306952758910' },
  check: { fallback: '✔️', id: '5206607081334906820' },
  plane: { fallback: '🛫', id: '5201691993775818138' },
  calc: { fallback: '🧮', id: '5190741648237161191' },
  game: { fallback: '🎮', id: '5361741454685256344' },
} as const

/** Premium custom emoji via HTML parse mode: <tg-emoji emoji-id="...">fallback</tg-emoji> */
export function tgPremiumEmoji(fallback: string, emojiId: string): string {
  return `<tg-emoji emoji-id="${emojiId}">${fallback}</tg-emoji>`
}
