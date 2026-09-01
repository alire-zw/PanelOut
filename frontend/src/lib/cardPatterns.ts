import type { CSSProperties } from 'react'

/** SVG overlays served from /public/pattern (only files that exist). */
export const CARD_PATTERN_URLS = [
  '/pattern/Pattern1.svg',
  '/pattern/Pattern2.svg',
  '/pattern/Pattern3.svg',
  '/pattern/Pattern4.svg',
  '/pattern/Pattern5.svg',
  '/pattern/Pattern6.svg',
  '/pattern/Shape1.svg',
  '/pattern/Shape2.svg',
  '/pattern/Pattern10.svg',
] as const

export type CardPatternUrl = (typeof CARD_PATTERN_URLS)[number]

export function getCardPattern(cardId: number): CardPatternUrl {
  return CARD_PATTERN_URLS[Math.abs(cardId) % CARD_PATTERN_URLS.length]!
}

export function getRandomCardPattern(): CardPatternUrl {
  const index = Math.floor(Math.random() * CARD_PATTERN_URLS.length)
  return CARD_PATTERN_URLS[index] ?? CARD_PATTERN_URLS[0]!
}

export function getCardTopBackgroundStyle(
  color1: string,
  color2: string,
  patternUrl: CardPatternUrl | string,
): CSSProperties {
  const gradient = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`
  return {
    background: gradient,
    backgroundImage: `url('${patternUrl}'), ${gradient}`,
    backgroundSize: 'cover, cover',
    backgroundPosition: 'center, center',
    backgroundRepeat: 'no-repeat, no-repeat',
  }
}

let preloadStarted = false

/** Warm browser cache so card patterns paint on first render. */
export function preloadCardPatterns(): void {
  if (preloadStarted || typeof Image === 'undefined') return
  preloadStarted = true
  for (const url of CARD_PATTERN_URLS) {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}
