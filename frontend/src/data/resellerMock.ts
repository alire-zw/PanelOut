/** Mock catalog for reseller shop / dashboard until APIs land. */

export type PanelTone = 'lime' | 'sky' | 'amber' | 'rose' | 'slate'

export type ResellerPanel = {
  id: string
  name: string
  host: string
  role: 'نماینده' | 'ادمین پنل'
  tone: PanelTone
  status: 'online' | 'degraded' | 'offline'
  usedGb: number
  quotaGb: number
  pricePerGb: number
  activeUsers: number
}

export type VpnPlan = {
  id: string
  panelId: string
  title: string
  volumeGb: number | null
  days: number
  price: number
  tag?: string
  popular?: boolean
}

export const resellerPanels: ResellerPanel[] = [
  {
    id: 'panel-marz',
    name: 'Marzban اصلی',
    host: 'vpn-core.example',
    role: 'نماینده',
    tone: 'lime',
    status: 'online',
    usedGb: 186.4,
    quotaGb: 500,
    pricePerGb: 4200,
    activeUsers: 48,
  },
  {
    id: 'panel-hide',
    name: 'Hiddify غرب',
    host: 'edge-west.example',
    role: 'ادمین پنل',
    tone: 'sky',
    status: 'online',
    usedGb: 92.1,
    quotaGb: 200,
    pricePerGb: 3900,
    activeUsers: 21,
  },
  {
    id: 'panel-xui',
    name: 'X-UI ایران',
    host: 'ir-node.example',
    role: 'نماینده',
    tone: 'amber',
    status: 'degraded',
    usedGb: 41.8,
    quotaGb: 100,
    pricePerGb: 4500,
    activeUsers: 9,
  },
]

export const vpnPlans: VpnPlan[] = [
  {
    id: 'p1',
    panelId: 'panel-marz',
    title: '۱۰ گیگ — یک‌ماهه',
    volumeGb: 10,
    days: 30,
    price: 49_000,
    tag: 'شروع',
  },
  {
    id: 'p2',
    panelId: 'panel-marz',
    title: '۵۰ گیگ — یک‌ماهه',
    volumeGb: 50,
    days: 30,
    price: 189_000,
    tag: 'پرفروش',
    popular: true,
  },
  {
    id: 'p3',
    panelId: 'panel-hide',
    title: '۱۰۰ گیگ — دوماهه',
    volumeGb: 100,
    days: 60,
    price: 329_000,
    popular: true,
  },
  {
    id: 'p4',
    panelId: 'panel-marz',
    title: 'نامحدود — ۱۵ روز',
    volumeGb: null,
    days: 15,
    price: 159_000,
    tag: 'تست',
  },
  {
    id: 'p5',
    panelId: 'panel-xui',
    title: '۲۰ گیگ — یک‌ماهه',
    volumeGb: 20,
    days: 30,
    price: 95_000,
  },
  {
    id: 'p6',
    panelId: 'panel-hide',
    title: '۲۰۰ گیگ — سه‌ماهه',
    volumeGb: 200,
    days: 90,
    price: 599_000,
    tag: 'عمده',
  },
]

export function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

export function formatFaMoney(value: number) {
  return `${formatFaNumber(value)} تومان`
}

export function panelById(id: string) {
  return resellerPanels.find((p) => p.id === id)
}
