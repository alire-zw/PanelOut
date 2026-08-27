import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { log } from '../lib/logger.js'
import type { ExecuteTransferInput } from './transfer.schema.js'
import { notifyTransferCompleted } from '../bot/notifications/transfer-success.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'

const TRANSFER_ORDER_ID_OFFSET = 100_000

function buildTransferOrderId(transferId: number): string {
  return `T-${TRANSFER_ORDER_ID_OFFSET + transferId}`
}

export class TransferError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'SELF_TRANSFER'
      | 'RECIPIENT_NOT_FOUND'
      | 'RECIPIENT_UNAVAILABLE'
      | 'INSUFFICIENT_BALANCE',
  ) {
    super(message)
    this.name = 'TransferError'
  }
}

function serializeRecipient(user: {
  telegramId: bigint
  firstName: string | null
  lastName: string | null
  username: string | null
  phoneNumber: string | null
}) {
  return {
    telegramId: Number(user.telegramId),
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    phoneNumber: user.phoneNumber,
  }
}

export async function executeTransfer(sender: DbUser, input: ExecuteTransferInput) {
  if (BigInt(input.recipientTelegramId) === sender.telegramId) {
    throw new TransferError('Cannot transfer to yourself', 'SELF_TRANSFER')
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentSender = await tx.user.findUnique({ where: { id: sender.id } })
    if (!currentSender) {
      throw new Error('Sender not found')
    }

    if (currentSender.balance < input.amount) {
      throw new TransferError('Insufficient balance', 'INSUFFICIENT_BALANCE')
    }

    const recipient = await tx.user.findUnique({
      where: { telegramId: BigInt(input.recipientTelegramId) },
    })

    if (!recipient) {
      throw new TransferError('Recipient not found', 'RECIPIENT_NOT_FOUND')
    }

    if (!recipient.isActive || recipient.isBanned || recipient.role !== 'user') {
      throw new TransferError('Recipient is unavailable', 'RECIPIENT_UNAVAILABLE')
    }

    const transfer = await tx.transfer.create({
      data: {
        transferId: `TMP-${sender.id}-${Date.now()}`,
        senderId: sender.id,
        recipientId: recipient.id,
        amount: input.amount,
      },
    })

    const transferId = buildTransferOrderId(transfer.id)

    const updatedTransfer = await tx.transfer.update({
      where: { id: transfer.id },
      data: { transferId },
      include: {
        recipient: {
          select: {
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true,
            phoneNumber: true,
          },
        },
      },
    })

    const updatedSender = await tx.user.update({
      where: { id: sender.id },
      data: { balance: { decrement: input.amount } },
    })

    await tx.user.update({
      where: { id: recipient.id },
      data: { balance: { increment: input.amount } },
    })

    return {
      transfer: updatedTransfer,
      balanceAfter: updatedSender.balance,
    }
  })

  log.info('TRANSFER', 'completed', {
    transferId: result.transfer.transferId,
    senderId: sender.id,
    recipientId: result.transfer.recipientId,
    amountToman: input.amount.toString(),
  })

  void notifyTransferCompleted({
    transferId: result.transfer.transferId,
    amountToman: input.amount,
    senderTelegramId: sender.telegramId,
    recipientTelegramId: result.transfer.recipient.telegramId,
  })

  void invalidateWalletTransactionsCache(sender.id)
  void invalidateWalletTransactionsCache(result.transfer.recipientId)

  return {
    transferId: result.transfer.transferId,
    amountToman: result.transfer.amount.toString(),
    recipient: serializeRecipient(result.transfer.recipient),
    balanceAfter: result.balanceAfter.toString(),
    createdAt: result.transfer.createdAt.toISOString(),
  }
}

export async function getTransferByOrderId(transferId: string, senderId: number) {
  const transfer = await prisma.transfer.findFirst({
    where: {
      transferId,
      senderId,
    },
    include: {
      recipient: {
        select: {
          telegramId: true,
          firstName: true,
          lastName: true,
          username: true,
          phoneNumber: true,
        },
      },
    },
  })

  if (!transfer) {
    return null
  }

  return {
    transferId: transfer.transferId,
    amountToman: transfer.amount.toString(),
    recipient: serializeRecipient(transfer.recipient),
    createdAt: transfer.createdAt.toISOString(),
  }
}
