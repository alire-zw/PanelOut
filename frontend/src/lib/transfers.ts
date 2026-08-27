import { apiFetch } from './api'
import type { TransferRecipient, TransferResult } from '../types/transfer'

export async function searchTransferRecipients(query: string): Promise<TransferRecipient[]> {
  const data = await apiFetch<{ ok: boolean; recipients: TransferRecipient[] }>(
    `/api/wallet/transfer/recipients?q=${encodeURIComponent(query)}`,
  )
  return Array.isArray(data.recipients) ? data.recipients : []
}

export async function executeTransfer(
  toTelegramId: number,
  amountToman: number,
): Promise<TransferResult> {
  const data = await apiFetch<{ ok: boolean; transfer: TransferResult }>('/api/wallet/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toTelegramId, amountToman }),
  })
  return data.transfer
}

export async function fetchTransferOrder(transferId: string): Promise<TransferResult> {
  const data = await apiFetch<{ ok: boolean; transfer: TransferResult }>(
    `/api/wallet/transfer/${encodeURIComponent(transferId)}`,
  )
  return data.transfer
}
