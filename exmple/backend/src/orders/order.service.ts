import { randomBytes } from 'node:crypto'
import type { OrderPaymentMethod, OrderStatus, Prisma } from '@prisma/client'
import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import {
  buildAccountShopOrderId,
  buildChannelViewsOrderId,
  buildPremiumOrderId,
  buildReactionOrderId,
  buildStarsOrderId,
  buildTelegramMembersOrderId,
  buildVirtualNumberOrderId,
} from './order.constants.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { invalidateUserOrdersCache } from './user-orders.cache.js'

function invalidateOrderCaches(userId: number): void {
  void invalidateWalletTransactionsCache(userId)
  void invalidateUserOrdersCache(userId)
}
export interface CreateStarsOrderInput {
  userId: number
  paymentMethod: OrderPaymentMethod
  amountToman: number
  walletAmountToman?: number
  quantity: number
  recipientUsername: string
  recipientName?: string
  recipientPhoto?: string
  paymentId?: number
  cryptoPaymentId?: number
}

function createTemporaryOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-SB-${userId}-${Date.now()}-${suffix}`
}

export async function createStarsOrder(input: CreateStarsOrderInput) {
  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'telegram-stars' },
  })

  if (!category) {
    throw new Error('Shop category not found')
  }

  const order = await prisma.order.create({
    data: {
      orderId: createTemporaryOrderId(input.userId),
      userId: input.userId,
      categoryId: category.id,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      amountToman: BigInt(input.amountToman),
      walletAmountToman: BigInt(input.walletAmountToman ?? 0),
      quantity: input.quantity,
      recipientUsername: input.recipientUsername,
      recipientName: input.recipientName ?? null,
      recipientPhoto: input.recipientPhoto ?? null,
      paymentId: input.paymentId ?? null,
      cryptoPaymentId: input.cryptoPaymentId ?? null,
    },
    include: { category: true },
  })

  const orderId = buildStarsOrderId(order.id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { orderId },
    include: { category: true },
  })
  invalidateOrderCaches(input.userId)
  return updated
}

export async function getOrderByOrderId(orderId: string, userId?: number) {
  return prisma.order.findFirst({
    where: {
      orderId,
      ...(userId ? { userId } : {}),
    },
    include: {
      category: true,
      virtualNumber: true,
      reactionOrder: true,
      channelViewOrder: true,
      telegramMemberOrder: true,
      accountShopOrder: true,
    },
  })
}

export async function listUserOrders(userId: number, limit = 20) {
  const take = Math.min(Math.max(limit, 1), 50)
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      category: true,
      virtualNumber: true,
      reactionOrder: true,
      channelViewOrder: true,
      telegramMemberOrder: true,
      accountShopOrder: true,
    },
  })
}

export async function getOrderByPaymentId(paymentId: number) {
  return prisma.order.findFirst({
    where: { paymentId },
    include: {
      category: true,
      virtualNumber: true,
      reactionOrder: true,
      channelViewOrder: true,
      telegramMemberOrder: true,
      accountShopOrder: true,
    },
  })
}

export async function getOrderByCryptoPaymentId(cryptoPaymentId: number) {
  return prisma.order.findFirst({
    where: { cryptoPaymentId },
    include: {
      category: true,
      virtualNumber: true,
      reactionOrder: true,
      channelViewOrder: true,
      telegramMemberOrder: true,
      accountShopOrder: true,
    },
  })
}

export async function linkOrderPayment(orderDbId: number, paymentId: number) {
  const updated = await prisma.order.update({
    where: { id: orderDbId },
    data: { paymentId },
    include: { category: true },
  })
  invalidateOrderCaches(updated.userId)
  return updated
}

export async function linkOrderCryptoPayment(orderDbId: number, cryptoPaymentId: number) {
  const updated = await prisma.order.update({
    where: { id: orderDbId },
    data: { cryptoPaymentId },
    include: { category: true },
  })
  invalidateOrderCaches(updated.userId)
  return updated
}

export async function updateOrderStatus(
  orderDbId: number,
  status: OrderStatus,
  timestamps?: { fulfilledAt?: Date; failedAt?: Date },
) {
  const updated = await prisma.order.update({
    where: { id: orderDbId },
    data: {
      status,
      ...(timestamps?.fulfilledAt ? { fulfilledAt: timestamps.fulfilledAt } : {}),
      ...(timestamps?.failedAt ? { failedAt: timestamps.failedAt } : {}),
    },
    include: { category: true },
  })
  invalidateOrderCaches(updated.userId)
  return updated
}

export async function markOrderFailedByPaymentId(paymentId: number) {
  const order = await getOrderByPaymentId(paymentId)
  if (!order || order.status === 'completed' || order.status === 'failed') {
    return order
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id } })
    if (!current || current.status === 'completed' || current.status === 'failed') {
      return current
    }

    if (current.walletAmountToman > 0n) {
      await tx.user.update({
        where: { id: current.userId },
        data: { balance: { increment: current.walletAmountToman } },
      })
    }

    return tx.order.update({
      where: { id: current.id },
      data: {
        status: 'failed',
        failedAt: new Date(),
      },
      include: { category: true },
    })
  })

  if (updated) {
    invalidateOrderCaches(updated.userId)
  }

  return updated
}

export async function markOrderFailedByCryptoPaymentId(cryptoPaymentId: number) {
  const order = await getOrderByCryptoPaymentId(cryptoPaymentId)
  if (!order || order.status === 'completed' || order.status === 'failed') {
    return order
  }

  return updateOrderStatus(order.id, 'failed', { failedAt: new Date() })
}

export async function createStarsOrderForUser(user: DbUser, input: Omit<CreateStarsOrderInput, 'userId'>) {
  return createStarsOrder({ ...input, userId: user.id })
}

export interface CreatePremiumOrderInput {
  userId: number
  paymentMethod: OrderPaymentMethod
  amountToman: number
  walletAmountToman?: number
  months: 3 | 6 | 12
  recipientUsername: string
  recipientName?: string
  recipientPhoto?: string
  paymentId?: number
  cryptoPaymentId?: number
}

function createTemporaryPremiumOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-PB-${userId}-${Date.now()}-${suffix}`
}

export async function createPremiumOrder(input: CreatePremiumOrderInput) {
  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'telegram-premium' },
  })

  if (!category) {
    throw new Error('Shop category not found')
  }

  const order = await prisma.order.create({
    data: {
      orderId: createTemporaryPremiumOrderId(input.userId),
      userId: input.userId,
      categoryId: category.id,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      amountToman: BigInt(input.amountToman),
      walletAmountToman: BigInt(input.walletAmountToman ?? 0),
      quantity: input.months,
      recipientUsername: input.recipientUsername,
      recipientName: input.recipientName ?? null,
      recipientPhoto: input.recipientPhoto ?? null,
      paymentId: input.paymentId ?? null,
      cryptoPaymentId: input.cryptoPaymentId ?? null,
    },
    include: { category: true },
  })

  const orderId = buildPremiumOrderId(order.id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { orderId },
    include: { category: true },
  })
  invalidateOrderCaches(input.userId)
  return updated
}

export async function createPremiumOrderForUser(
  user: DbUser,
  input: Omit<CreatePremiumOrderInput, 'userId'>,
) {
  return createPremiumOrder({ ...input, userId: user.id })
}

export interface CreateVirtualNumberOrderInput {
  userId: number
  paymentMethod: OrderPaymentMethod
  amountToman: number
  walletAmountToman?: number
  countryId: string
  country: string
  flagCode: string
  quality: 'economy' | 'standard' | 'premium'
  paymentId?: number
}

function createTemporaryVirtualNumberOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-VB-${userId}-${Date.now()}-${suffix}`
}

export async function createVirtualNumberOrder(input: CreateVirtualNumberOrderInput) {
  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'virtual-number' },
  })

  if (!category) {
    throw new Error('Shop category not found')
  }

  const order = await prisma.order.create({
    data: {
      orderId: createTemporaryVirtualNumberOrderId(input.userId),
      userId: input.userId,
      categoryId: category.id,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      amountToman: BigInt(input.amountToman),
      walletAmountToman: BigInt(input.walletAmountToman ?? 0),
      // countryId is required later for Callinoo purchase
      recipientUsername: input.countryId,
      recipientName: input.country,
      recipientPhoto: input.flagCode,
      paymentId: input.paymentId ?? null,
    },
    include: { category: true },
  })

  const orderId = buildVirtualNumberOrderId(order.id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { orderId },
    include: { category: true },
  })
  invalidateOrderCaches(input.userId)
  return updated
}

export async function createVirtualNumberOrderForUser(
  user: DbUser,
  input: Omit<CreateVirtualNumberOrderInput, 'userId'>,
) {
  return createVirtualNumberOrder({ ...input, userId: user.id })
}

export type ReactionOrderItemRecord = {
  serviceId: number
  emoji: string
  quantity: number
  rate: number
  toman: number
  providerOrderId?: string | null
}

export interface CreateReactionOrderInput {
  userId: number
  paymentMethod: OrderPaymentMethod
  amountToman: number
  walletAmountToman?: number
  quantity: number
  post: {
    username: string
    messageId: number
    link: string
    title: string
    preview?: string
    photo?: string
  }
  items: ReactionOrderItemRecord[]
  paymentId?: number
}

function createTemporaryReactionOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-RB-${userId}-${Date.now()}-${suffix}`
}

export async function createReactionOrder(input: CreateReactionOrderInput) {
  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'reaction' },
  })

  if (!category) {
    throw new Error('Shop category not found')
  }

  const order = await prisma.order.create({
    data: {
      orderId: createTemporaryReactionOrderId(input.userId),
      userId: input.userId,
      categoryId: category.id,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      amountToman: BigInt(input.amountToman),
      walletAmountToman: BigInt(input.walletAmountToman ?? 0),
      quantity: input.quantity,
      recipientUsername: input.post.username.slice(0, 64),
      recipientName: input.post.title.slice(0, 128),
      recipientPhoto: input.post.photo || null,
      paymentId: input.paymentId ?? null,
      reactionOrder: {
        create: {
          postLink: input.post.link,
          postUsername: input.post.username.slice(0, 64),
          postMessageId: input.post.messageId,
          postTitle: input.post.title.slice(0, 128),
          postPreview: input.post.preview?.slice(0, 255) || null,
          postPhoto: input.post.photo || null,
          itemsJson: input.items as Prisma.InputJsonValue,
        },
      },
    },
    include: { category: true, reactionOrder: true },
  })

  const orderId = buildReactionOrderId(order.id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { orderId },
    include: { category: true, reactionOrder: true },
  })
  invalidateOrderCaches(input.userId)
  return updated
}

export async function createReactionOrderForUser(
  user: DbUser,
  input: Omit<CreateReactionOrderInput, 'userId'>,
) {
  return createReactionOrder({ ...input, userId: user.id })
}

export interface CreateChannelViewsOrderInput {
  userId: number
  paymentMethod: OrderPaymentMethod
  amountToman: number
  walletAmountToman?: number
  quantity: number
  rate: number
  serviceId: number
  post: {
    username: string
    messageId: number
    link: string
    title: string
    preview?: string
    photo?: string
  }
  paymentId?: number
}

function createTemporaryChannelViewsOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-CV-${userId}-${Date.now()}-${suffix}`
}

export async function createChannelViewsOrder(input: CreateChannelViewsOrderInput) {
  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'channel-views' },
  })

  if (!category) {
    throw new Error('Shop category not found')
  }

  const order = await prisma.order.create({
    data: {
      orderId: createTemporaryChannelViewsOrderId(input.userId),
      userId: input.userId,
      categoryId: category.id,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      amountToman: BigInt(input.amountToman),
      walletAmountToman: BigInt(input.walletAmountToman ?? 0),
      quantity: input.quantity,
      recipientUsername: input.post.username.slice(0, 64),
      recipientName: input.post.title.slice(0, 128),
      recipientPhoto: input.post.photo || null,
      paymentId: input.paymentId ?? null,
      channelViewOrder: {
        create: {
          postLink: input.post.link,
          postUsername: input.post.username.slice(0, 64),
          postMessageId: input.post.messageId,
          postTitle: input.post.title.slice(0, 128),
          postPreview: input.post.preview?.slice(0, 255) || null,
          postPhoto: input.post.photo || null,
          serviceId: input.serviceId,
          quantity: input.quantity,
          rate: Math.round(input.rate),
          toman: input.amountToman,
        },
      },
    },
    include: { category: true, channelViewOrder: true },
  })

  const orderId = buildChannelViewsOrderId(order.id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { orderId },
    include: { category: true, channelViewOrder: true },
  })
  invalidateOrderCaches(input.userId)
  return updated
}

export async function createChannelViewsOrderForUser(
  user: DbUser,
  input: Omit<CreateChannelViewsOrderInput, 'userId'>,
) {
  return createChannelViewsOrder({ ...input, userId: user.id })
}

export interface CreateTelegramMembersOrderInput {
  userId: number
  paymentMethod: OrderPaymentMethod
  amountToman: number
  walletAmountToman?: number
  quantity: number
  rate: number
  serviceId: number
  channel: {
    username: string
    link: string
    title: string
    photo?: string
    subscribers?: string
  }
  paymentId?: number
}

function createTemporaryTelegramMembersOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-TM-${userId}-${Date.now()}-${suffix}`
}

export async function createTelegramMembersOrder(input: CreateTelegramMembersOrderInput) {
  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'telegram-members' },
  })

  if (!category) {
    throw new Error('Shop category not found')
  }

  const order = await prisma.order.create({
    data: {
      orderId: createTemporaryTelegramMembersOrderId(input.userId),
      userId: input.userId,
      categoryId: category.id,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      amountToman: BigInt(input.amountToman),
      walletAmountToman: BigInt(input.walletAmountToman ?? 0),
      quantity: input.quantity,
      recipientUsername: input.channel.username.slice(0, 64),
      recipientName: input.channel.title.slice(0, 128),
      recipientPhoto: input.channel.photo || null,
      paymentId: input.paymentId ?? null,
      telegramMemberOrder: {
        create: {
          channelLink: input.channel.link,
          channelUsername: input.channel.username.slice(0, 64),
          channelTitle: input.channel.title.slice(0, 128),
          channelPhoto: input.channel.photo || null,
          channelSubscribers: input.channel.subscribers?.slice(0, 64) || null,
          serviceId: input.serviceId,
          quantity: input.quantity,
          rate: Math.round(input.rate),
          toman: input.amountToman,
        },
      },
    },
    include: { category: true, telegramMemberOrder: true },
  })

  const orderId = buildTelegramMembersOrderId(order.id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { orderId },
    include: { category: true, telegramMemberOrder: true },
  })
  invalidateOrderCaches(input.userId)
  return updated
}

export async function createTelegramMembersOrderForUser(
  user: DbUser,
  input: Omit<CreateTelegramMembersOrderInput, 'userId'>,
) {
  return createTelegramMembersOrder({ ...input, userId: user.id })
}

export interface CreateAccountShopOrderInput {
  userId: number
  paymentMethod: OrderPaymentMethod
  amountToman: number
  walletAmountToman?: number
  planId: number
  accountCategoryId: string
  planName: string
  durationLabel: string
  warrantyLabel: string
  fieldValues: Record<string, string>
  customFields: Array<{
    id: string
    label: string
    placeholder: string
    required: boolean
  }>
  paymentId?: number
}

function createTemporaryAccountShopOrderId(userId: number): string {
  const suffix = randomBytes(3).toString('hex')
  return `TMP-AC-${userId}-${Date.now()}-${suffix}`
}

export async function createAccountShopOrder(input: CreateAccountShopOrderInput) {
  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'chatgpt' },
  })

  if (!category) {
    throw new Error('Shop category not found')
  }

  const order = await prisma.order.create({
    data: {
      orderId: createTemporaryAccountShopOrderId(input.userId),
      userId: input.userId,
      categoryId: category.id,
      status: 'pending',
      paymentMethod: input.paymentMethod,
      amountToman: BigInt(input.amountToman),
      walletAmountToman: BigInt(input.walletAmountToman ?? 0),
      quantity: 1,
      recipientName: input.planName.slice(0, 128),
      paymentId: input.paymentId ?? null,
      accountShopOrder: {
        create: {
          planId: input.planId,
          accountCategoryId: input.accountCategoryId.slice(0, 32),
          planName: input.planName.slice(0, 160),
          durationLabel: input.durationLabel.slice(0, 96),
          warrantyLabel: input.warrantyLabel.slice(0, 96),
          fieldValuesJson: input.fieldValues,
          customFieldsJson: input.customFields,
          toman: input.amountToman,
          status: 'registered',
        },
      },
    },
    include: { category: true, accountShopOrder: true },
  })

  const orderId = buildAccountShopOrderId(order.id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { orderId },
    include: { category: true, accountShopOrder: true },
  })
  invalidateOrderCaches(input.userId)
  return updated
}

export async function createAccountShopOrderForUser(
  user: DbUser,
  input: Omit<CreateAccountShopOrderInput, 'userId'>,
) {
  return createAccountShopOrder({ ...input, userId: user.id })
}
