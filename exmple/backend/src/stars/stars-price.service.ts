import { convertTonToToman, getTonIrtPrice } from '../crypto-payments/swapwallet.client.js'
import { applyProductPricing } from '../pricing/product-pricing.apply.js'
import {
  readCachedMarketPrice,
  readCachedTonIrtPrice,
  writeCachedMarketPrice,
  writeCachedTonIrtPrice,
} from './stars-price.cache.js'
import { getStarsPrice } from './marketapp.client.js'

export interface StarsPriceQuote {
  quantity: number
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

async function getCachedOrFetchMarketPrice(quantity: number) {
  const cached = await readCachedMarketPrice(quantity)
  if (cached != null) {
    return cached
  }

  const price = await getStarsPrice(quantity)
  await writeCachedMarketPrice(quantity, price)
  return price
}

export async function getStarsPriceQuote(quantity: number): Promise<StarsPriceQuote> {
  const [marketPrice, tonIrtPrice] = await Promise.all([
    getCachedOrFetchMarketPrice(quantity),
    getCachedOrFetchTonIrtPrice(),
  ])

  const baseToman = convertTonToToman(marketPrice.ton, tonIrtPrice)

  return {
    quantity,
    ton: marketPrice.ton,
    gram: marketPrice.gram,
    toman: await applyProductPricing('telegram-stars', baseToman),
  }
}
