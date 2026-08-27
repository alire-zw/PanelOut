export type WalletTransactionStatus = 'success' | 'pending' | 'failed'

export type WalletTransactionType = 'deposit' | 'purchase' | 'transfer' | 'refund'

export type WalletPaymentMethod = 'wallet' | 'zibal' | 'tron' | 'card' | null

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
}
