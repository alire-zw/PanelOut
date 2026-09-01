export type WalletTransactionStatus = 'success' | 'pending' | 'failed'

export type WalletTransactionType =
  | 'deposit'
  | 'purchase'
  | 'transfer'
  | 'refund'
  | 'panel_usage'
  | 'outbound_usage'
  | 'outbound_volume_purchase'

export type WalletPaymentMethod = 'wallet' | 'zibal' | 'tron' | 'card' | 'panel_wallet' | null

export type PanelWalletSource = 'main' | 'panel'

export type PanelServiceType =
  | 'panel_usage'
  | 'panel_reseller'
  | 'panel_trial'
  | 'panel_unlimited'
  | 'outbound_volume'
  | 'outbound_usage'

export type ChargePaymentMethod = 'card' | 'tron'

export type WalletChargeAmountState = {
  amount: number
}

export type WalletTransferAmountState = {
  amount: number
}

export type WalletTransaction = {
  id: string
  title: string
  subtitle?: string | null
  date: string
  amount: number
  status: WalletTransactionStatus
  type: WalletTransactionType
  paymentMethod?: WalletPaymentMethod
  transferDirection?: 'in' | 'out' | null
  orderId?: string | null
  createdAt?: string | null
  verifiedAt?: string | null
  expiresAt?: string | null
  walletAmountToman?: number | null
  gatewayAmountToman?: number | null
  categorySlug?: string | null
  recipientUsername?: string | null
  recipientName?: string | null
  quantity?: number | null
  counterpartyTelegramId?: number | null
  trackId?: string | null
  refNumber?: string | null
  cardNumber?: string | null
  amountTrx?: string | null
  incomingTxHash?: string | null
  adminNote?: string | null
  panelUsername?: string | null
  panelServiceType?: PanelServiceType | null
  trafficBytes?: string | null
  trafficGb?: string | null
  walletSource?: PanelWalletSource | null
  chargeCount?: number | null
  invoiceNumber?: number | null
  anchorChargeId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}
