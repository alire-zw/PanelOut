import { TronWeb } from 'tronweb'
import { env } from '../config/env.js'
import { getTronFullHost } from './tron.config.js'

let tronWebInstance: TronWeb | null = null

export function getTronWeb(): TronWeb {
  if (!tronWebInstance) {
    tronWebInstance = new TronWeb({
      fullHost: getTronFullHost(),
      headers: { 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY },
    })
  }

  return tronWebInstance
}

export function getTronWebForPrivateKey(privateKey: string): TronWeb {
  const tronWeb = getTronWeb()
  tronWeb.setPrivateKey(privateKey)
  return tronWeb
}
