import { env } from '../config/env.js'

export const TRON_SUN_PER_TRX = 1_000_000n
export const MIN_SWEEP_SUN = 1n

export const tronNetworkConfig = {
  shasta: {
    fullHost: 'https://api.shasta.trongrid.io',
    name: 'Shasta Testnet',
  },
  mainnet: {
    fullHost: 'https://api.trongrid.io',
    name: 'TRON Mainnet',
  },
} as const

export function getTronFullHost(): string {
  return tronNetworkConfig[env.TRON_NETWORK].fullHost
}
