import type { TransferRecipient } from '../types/transfer'

const STORAGE_KEY = 'panelout.transfer.recent'
const MAX_RECENT = 12

function readRecent(): TransferRecipient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TransferRecipient[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getRecentTransferRecipients(): TransferRecipient[] {
  return readRecent()
}

export function saveRecentTransferRecipient(recipient: TransferRecipient) {
  const next = [
    recipient,
    ...readRecent().filter((item) => item.telegramId !== recipient.telegramId),
  ].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function formatTransferRecipientName(recipient: TransferRecipient): string {
  return (
    recipient.realName?.trim() ||
    recipient.telegramName?.trim() ||
    (recipient.username ? `@${recipient.username}` : null) ||
    `کاربر ${recipient.telegramId}`
  )
}

export function formatTransferRecipientHandle(recipient: TransferRecipient): string | null {
  return recipient.username ? `@${recipient.username}` : null
}

export function formatTransferRecipientTelegramId(telegramId: number): string {
  return String(telegramId)
}

export function getTransferRecipientInitials(recipient: TransferRecipient): string {
  const name = formatTransferRecipientName(recipient).replace(/^@/, '').trim()
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase()
  }
  return (parts[0]?.slice(0, 2) || '؟').toUpperCase()
}
