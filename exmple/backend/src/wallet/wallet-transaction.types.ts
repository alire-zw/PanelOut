export type WalletTransactionType = 'deposit' | 'transfer' | 'purchase' | 'refund'
export type WalletTransactionStatus = 'success' | 'pending' | 'failed'
export type WalletTransferDirection = 'in' | 'out'

export interface SerializedWalletTransaction {
  id: string
  type: WalletTransactionType
  title: string
  amount: number
  date: string
  status: WalletTransactionStatus
  paymentMethod?: 'zibal' | 'tron' | 'wallet'
  orderId?: string
  createdAt: string
  verifiedAt?: string | null
  refNumber?: string | null
  trackId?: string | null
  cardNumber?: string | null
  amountTrx?: string | null
  incomingTxHash?: string | null
  expiresAt?: string | null
  transferDirection?: WalletTransferDirection
  counterpartyTelegramId?: number
  recipientUsername?: string | null
  recipientName?: string | null
  quantity?: number | null
  categorySlug?: string | null
  walletAmountToman?: number
  gatewayAmountToman?: number
}

export interface CachedWalletTransactions {
  version: string
  cachedAt: string
  items: SerializedWalletTransaction[]
}

export interface WalletTransactionsSyncResult {
  changed: boolean
  version: string
  cachedAt: string
  items: SerializedWalletTransaction[]
}
