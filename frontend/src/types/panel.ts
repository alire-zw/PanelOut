import type { PanelCredentials } from '../lib/panelApi'

export type PanelCredentialsState = {
  credentials: PanelCredentials
  kind: 'trial' | 'usage' | 'reseller' | 'import'
}

export type PanelUsageFlowState = {
  upgradeFromTrial: boolean
}
