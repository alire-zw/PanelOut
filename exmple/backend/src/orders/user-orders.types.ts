import type { SerializedOrder } from './order.serializer.js'

export interface CachedUserOrders {
  version: string
  cachedAt: string
  items: SerializedOrder[]
}

export interface UserOrdersSyncResult extends CachedUserOrders {
  changed: boolean
}
