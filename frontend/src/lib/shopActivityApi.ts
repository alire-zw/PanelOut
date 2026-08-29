import { apiFetch } from './api'

export type ShopActivity = {
  trafficBytes: number
  totalUsers: number
  onlineUsers: number
  activeUsers: number
  resellerCount: number
  uptimeSeconds: number | null
  panelCount: number
  connectedPanelCount: number
  cachedAt: string | null
}

export async function fetchShopActivity() {
  const data = await apiFetch<{ ok: boolean; activity: ShopActivity }>(
    '/api/shop/activity',
  )
  return data.activity
}
