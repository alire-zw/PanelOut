const FLAG_EMOJI_REGEX = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/g
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]|[\uD83C][\uDF00-\uDFFF]|[\uD83D][\uDC00-\uDFFF]|[\uD83E][\uDD00-\uDDFF]/gu

export function flagEmojiToAlpha2(emoji: string): string | null {
  const match = emoji.match(FLAG_EMOJI_REGEX)
  if (!match?.[0]) {
    return null
  }

  const codePoints = [...match[0]].map((char) => char.codePointAt(0) ?? 0)
  if (codePoints.length < 2) {
    return null
  }

  const isRegionalIndicator = codePoints.every(
    (point) => point >= 0x1f1e6 && point <= 0x1f1ff,
  )

  if (!isRegionalIndicator) {
    return null
  }

  return String.fromCharCode(
    ...codePoints.slice(0, 2).map((point) => point - 0x1f1e6 + 65),
  ).toLowerCase()
}

export function stripCountryEmojis(value: string): string {
  return value
    .replace(FLAG_EMOJI_REGEX, ' ')
    .replace(EMOJI_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildCountryFlagUrl(flagCode: string): string {
  return `https://countryflagsapi.netlify.app/flag/${flagCode.toLowerCase()}.svg`
}
