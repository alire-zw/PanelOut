import { env } from '../config/env.js'

export class SwapWalletApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SwapWalletApiError'
  }
}

interface MarketPricesResponse {
  status: string
  result: Record<string, string>
}

async function fetchMarketPrices(): Promise<Record<string, string>> {
  const response = await fetch(`${env.SWAPWALLET_API_URL}/v1/market/prices`, {
    headers: {
      Authorization: `Apikey ${env.SWAPWALLET_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new SwapWalletApiError(`SwapWallet price request failed: ${response.status}`)
  }

  const data = (await response.json()) as MarketPricesResponse
  return data.result ?? {}
}

function parsePositivePrice(value: string | undefined, pair: string): number {
  const price = Number.parseFloat(value ?? '')

  if (!Number.isFinite(price) || price <= 0) {
    throw new SwapWalletApiError(`Invalid ${pair} price from SwapWallet`)
  }

  return price
}

export async function getTrxIrtPrice(): Promise<number> {
  const prices = await fetchMarketPrices()
  return parsePositivePrice(prices['TRX/IRT'], 'TRX/IRT')
}

export async function getTonIrtPrice(): Promise<number> {
  const prices = await fetchMarketPrices()
  return parsePositivePrice(prices['TON/IRT'], 'TON/IRT')
}

export async function getUsdtIrtPrice(): Promise<number> {
  const prices = await fetchMarketPrices()
  return parsePositivePrice(prices['USDT/IRT'], 'USDT/IRT')
}

/** SwapWallet IRT pairs are quoted in Rial per coin. */
export function convertTonToToman(tonAmount: number, tonIrtPrice: number): number {
  if (!Number.isFinite(tonAmount) || tonAmount <= 0) {
    return 0
  }

  return Math.ceil(tonAmount * tonIrtPrice)
}

/** Convert USDT/USD amount to display toman using SwapWallet USDT/IRT. */
export function convertUsdtToToman(usdtAmount: number, usdtIrtPrice: number): number {
  if (!Number.isFinite(usdtAmount) || usdtAmount <= 0) {
    return 0
  }

  return Math.ceil(usdtAmount * usdtIrtPrice)
}

export function calculateTrxAmountFromToman(amountToman: bigint, trxIrtPrice: number): {
  amountTrx: string
  amountTrxSun: bigint
} {
  const toman = Number(amountToman)
  const trx = toman / trxIrtPrice
  const roundedTrx = Math.ceil(trx * 1_000_000) / 1_000_000
  const amountTrxSun = BigInt(Math.ceil(roundedTrx * 1_000_000))

  return {
    amountTrx: roundedTrx.toFixed(6),
    amountTrxSun,
  }
}
