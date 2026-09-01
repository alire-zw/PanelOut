import type { PanelSubscription } from './panelApi'

export function isOutboundSubscription(panel: PanelSubscription) {
  return (
    Boolean(panel.isOutbound) ||
    panel.serviceType === 'outbound_volume' ||
    panel.serviceType === 'outbound_usage'
  )
}

export function isPanelSubscription(panel: PanelSubscription) {
  return !isOutboundSubscription(panel)
}
