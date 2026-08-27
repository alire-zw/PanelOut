import {
  fetchPowerTelServices,
  type PowerTelService,
} from './powertel.client.js'
import {
  readCachedPowerTelServices,
  writeCachedPowerTelServices,
} from './powertel-services.cache.js'

/** Power-Tel rate is per 1000 units */
export function calcReactionItemToman(quantity: number, rate: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.ceil((quantity / 1000) * rate)
}

export async function getPowerTelServicesMap(): Promise<{
  byId: Map<number, PowerTelService>
  cached: boolean
}> {
  const cached = await readCachedPowerTelServices()
  if (cached) {
    return {
      byId: new Map(cached.map((item) => [item.service, item])),
      cached: true,
    }
  }

  const services = await fetchPowerTelServices()
  await writeCachedPowerTelServices(services)

  return {
    byId: new Map(services.map((item) => [item.service, item])),
    cached: false,
  }
}
