export type BankCard = {
  id: number
  cardNumber: string
  sheba: string | null
  holderName: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type CardChargeStatus = 'pending' | 'approved' | 'rejected'

export type CardChargeUser = {
  telegramId: number
  username: string | null
  telegramName: string | null
  realName: string | null
}

export type CardChargeRequest = {
  id: number
  telegramUserId: number
  amountToman: number
  bankCardId: number | null
  bankCard: BankCard | null
  receiptUrl: string
  receiptMime: string
  status: CardChargeStatus
  adminNote: string | null
  reviewedBy: number | null
  reviewedAt: string | null
  createdAt: string | null
  user: CardChargeUser | null
}
