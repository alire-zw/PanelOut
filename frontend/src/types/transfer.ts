export type TransferRecipient = {
  telegramId: number
  username: string | null
  telegramName: string | null
  realName: string | null
}

export type WalletTransferRecipientState = {
  amount: number
  recipient?: TransferRecipient
}

export type WalletTransferConfirmState = {
  amount: number
  recipient: TransferRecipient
}

export type TransferResult = {
  transferId: string
  amountToman: number
  balanceAfter?: string
  createdAt?: string | null
  recipient: TransferRecipient
}
