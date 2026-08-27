import { convertTonToToman, getTonIrtPrice } from '../crypto-payments/swapwallet.client.js'
import { applyProductPricing } from '../pricing/product-pricing.apply.js'
import { readCachedTonIrtPrice, writeCachedTonIrtPrice } from '../stars/stars-price.cache.js'
import type { PremiumMonths } from '../stars/marketapp.client.js'
import { getPremiumPrice, getPremiumPrices } from '../stars/marketapp.client.js'
import { readCachedPremiumPrices, writeCachedPremiumPrices } from './premium-price.cache.js'

export interface PremiumPriceQuote {
  months: PremiumMonths
  ton: number
  gram: number
  toman: number
}

async function getCachedOrFetchTonIrtPrice(): Promise<number> {
  const cached = await readCachedTonIrtPrice()
  if (cached != null) {
    return cached
  }

  const price = await getTonIrtPrice()
  await writeCachedTonIrtPrice(price)
  return price
}

async function getCachedOrFetchPremiumPrices() {
  const cached = await readCachedPremiumPrices()
  if (cached != null) {
    return cached
  }

  const { items } = await getPremiumPrices()
  await writeCachedPremiumPrices(items)
  return items
}

export async function getAllPremiumPriceQuotes(): Promise<PremiumPriceQuote[]> {
  const [items, tonIrtPrice] = await Promise.all([
    getCachedOrFetchPremiumPrices(),
    getCachedOrFetchTonIrtPrice(),
  ])

  return Promise.all(
    items.map(async (item) => ({
      months: item.months,
      ton: item.ton,
      gram: item.gram,
      toman: await applyProductPricing(
        'telegram-premium',
        convertTonToToman(item.ton, tonIrtPrice),
      ),
    })),
  )
}

export async function getPremiumPriceQuote(months: PremiumMonths): Promise<PremiumPriceQuote> {
  const quotes = await getAllPremiumPriceQuotes()
  const quote = quotes.find((item) => item.months === months)
  if (!quote) {
    const marketPrice = await getPremiumPrice(months)
    const tonIrtPrice = await getCachedOrFetchTonIrtPrice()
    return {
      months,
      ton: marketPrice.ton,
      gram: marketPrice.gram,
      toman: await applyProductPricing(
        'telegram-premium',
        convertTonToToman(marketPrice.ton, tonIrtPrice),
      ),
    }
  }

  return quote
}
