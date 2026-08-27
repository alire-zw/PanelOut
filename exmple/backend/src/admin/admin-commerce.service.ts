import { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import {
  ACCOUNT_SHOP_CATEGORIES,
  accountShopProductKey,
} from '../chatgpt/account-shop.catalog.js'
import { SHOP_CATEGORIES } from '../orders/shop-category.data.js'
import type {
  CreateClubRewardInput,
  CreateDiscountInput,
  CreateTicketInput,
  ListTicketsQuery,
  ReplyTicketInput,
  UpdateClubRewardInput,
  UpdateDiscountInput,
  UpsertPricingInput,
} from './admin-commerce.schema.js'
import { SUPPORT_CATEGORY_LABELS } from '../support/support.schema.js'
import { afterAdminTicketReply } from '../support/support.service.js'
import { invalidateUserSupportCaches } from '../support/support-tickets.service.js'
import { invalidateProductPricingCache } from '../pricing/product-pricing.apply.js'
import { subjectFromCategory, ticketCodeFromId } from '../support/support.serializer.js'

function serializeReward(row: {
  id: number
  title: string
  description: string
  pointsCost: number
  rewardType: string
  rewardValue: string
  stock: number | null
  isActive: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pointsCost: row.pointsCost,
    rewardType: row.rewardType,
    rewardValue: row.rewardValue,
    stock: row.stock,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeDiscount(row: {
  id: number
  code: string
  title: string
  description: string | null
  discountType: string
  discountValue: number
  maxUses: number | null
  usedCount: number
  minOrderToman: bigint | null
  productKey: string | null
  startsAt: Date | null
  expiresAt: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    minOrderToman: row.minOrderToman?.toString() ?? null,
    productKey: row.productKey,
    startsAt: row.startsAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listClubRewards() {
  const items = await prisma.clubReward.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
  })
  return { items: items.map(serializeReward) }
}

export async function createClubReward(input: CreateClubRewardInput) {
  const row = await prisma.clubReward.create({
    data: {
      title: input.title,
      description: input.description,
      pointsCost: input.pointsCost,
      rewardType: input.rewardType,
      rewardValue: input.rewardValue,
      stock: input.stock ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  })
  return { reward: serializeReward(row) }
}

export async function updateClubReward(id: number, input: UpdateClubRewardInput) {
  const row = await prisma.clubReward.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.pointsCost !== undefined ? { pointsCost: input.pointsCost } : {}),
      ...(input.rewardType !== undefined ? { rewardType: input.rewardType } : {}),
      ...(input.rewardValue !== undefined ? { rewardValue: input.rewardValue } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  })
  return { reward: serializeReward(row) }
}

export async function deleteClubReward(id: number) {
  await prisma.clubReward.delete({ where: { id } })
  return { ok: true }
}

export async function listDiscounts() {
  const items = await prisma.discountCode.findMany({
    orderBy: [{ isActive: 'desc' }, { id: 'desc' }],
  })
  return { items: items.map(serializeDiscount) }
}

export async function createDiscount(input: CreateDiscountInput) {
  const row = await prisma.discountCode.create({
    data: {
      code: input.code.toUpperCase(),
      title: input.title,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxUses: input.maxUses ?? null,
      minOrderToman:
        input.minOrderToman != null ? BigInt(input.minOrderToman) : null,
      productKey: input.productKey ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: input.isActive ?? true,
    },
  })
  return { discount: serializeDiscount(row) }
}

export async function updateDiscount(id: number, input: UpdateDiscountInput) {
  const row = await prisma.discountCode.update({
    where: { id },
    data: {
      ...(input.code !== undefined ? { code: input.code.toUpperCase() } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
      ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
      ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
      ...(input.minOrderToman !== undefined
        ? {
            minOrderToman:
              input.minOrderToman != null ? BigInt(input.minOrderToman) : null,
          }
        : {}),
      ...(input.productKey !== undefined ? { productKey: input.productKey } : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })
  return { discount: serializeDiscount(row) }
}

export async function deleteDiscount(id: number) {
  await prisma.discountCode.delete({ where: { id } })
  return { ok: true }
}

export async function listProductPricing() {
  const rows = await prisma.productPricing.findMany()
  const byKey = new Map(rows.map((row) => [row.productKey, row]))

  const shopItems = SHOP_CATEGORIES.map((category) => {
    const row = byKey.get(category.slug)
    return {
      productKey: category.slug,
      label: row?.label ?? category.label,
      markupPercent: row?.markupPercent ?? 0,
      fixedAddToman: (row?.fixedAddToman ?? 0n).toString(),
      isActive: row?.isActive ?? true,
      note: row?.note ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    }
  })

  const accountItems = ACCOUNT_SHOP_CATEGORIES.map((category) => {
    const productKey = accountShopProductKey(category.id)
    const row = byKey.get(productKey)
    return {
      productKey,
      label: row?.label ?? category.labelFa,
      markupPercent: row?.markupPercent ?? 0,
      fixedAddToman: (row?.fixedAddToman ?? 0n).toString(),
      isActive: row?.isActive ?? true,
      note: row?.note ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    }
  })

  return { items: [...shopItems, ...accountItems] }
}

export async function upsertProductPricing(input: UpsertPricingInput) {
  const row = await prisma.productPricing.upsert({
    where: { productKey: input.productKey },
    create: {
      productKey: input.productKey,
      label: input.label,
      markupPercent: input.markupPercent,
      fixedAddToman: BigInt(input.fixedAddToman),
      isActive: input.isActive ?? true,
      note: input.note ?? null,
    },
    update: {
      label: input.label,
      markupPercent: input.markupPercent,
      fixedAddToman: BigInt(input.fixedAddToman),
      isActive: input.isActive ?? true,
      note: input.note ?? null,
    },
  })

  invalidateProductPricingCache()

  return {
    pricing: {
      productKey: row.productKey,
      label: row.label,
      markupPercent: row.markupPercent,
      fixedAddToman: row.fixedAddToman.toString(),
      isActive: row.isActive,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    },
  }
}

export async function listSupportTickets(query: ListTicketsQuery) {
  const where: Prisma.SupportTicketWhereInput = {}
  if (query.status) where.status = query.status
  if (query.category) where.category = query.category
  if (query.search) {
    const q = query.search
    where.OR = [
      { ticketCode: { contains: q } },
      { subject: { contains: q } },
      { orderId: { contains: q } },
      { user: { username: { contains: q } } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  return {
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    items: items.map((ticket) => ({
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      category: ticket.category,
      categoryLabel: SUPPORT_CATEGORY_LABELS[ticket.category],
      orderId: ticket.orderId,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      user: {
        id: ticket.user.id,
        telegramId: ticket.user.telegramId.toString(),
        username: ticket.user.username,
        firstName: ticket.user.firstName,
        lastName: ticket.user.lastName,
      },
      lastMessage: ticket.messages[0]
        ? {
            senderRole: ticket.messages[0].senderRole,
            body: ticket.messages[0].body,
            createdAt: ticket.messages[0].createdAt.toISOString(),
          }
        : null,
    })),
  }
}

export async function getSupportTicket(id: number) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      order: {
        select: {
          orderId: true,
          status: true,
          amountToman: true,
          category: { select: { slug: true, label: true } },
        },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!ticket) return null

  return {
    ticket: {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      category: ticket.category,
      categoryLabel: SUPPORT_CATEGORY_LABELS[ticket.category],
      orderId: ticket.orderId,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      user: {
        id: ticket.user.id,
        telegramId: ticket.user.telegramId.toString(),
        username: ticket.user.username,
        firstName: ticket.user.firstName,
        lastName: ticket.user.lastName,
      },
      order: ticket.order
        ? {
            orderId: ticket.order.orderId,
            status: ticket.order.status,
            amountToman: ticket.order.amountToman.toString(),
            category: ticket.order.category,
          }
        : null,
      messages: ticket.messages.map((message) => ({
        id: message.id,
        senderRole: message.senderRole,
        body: message.body,
        imageData: (message as { imageData?: string | null }).imageData ?? null,
        createdAt: message.createdAt.toISOString(),
      })),
    },
  }
}

export async function createSupportTicket(input: CreateTicketInput) {
  if (input.orderId) {
    const order = await prisma.order.findFirst({
      where: { orderId: input.orderId, userId: input.userId },
      select: { id: true },
    })
    if (!order) {
      throw new Error('Order not found for user')
    }
  }

  const subject = input.subject?.trim() || subjectFromCategory(input.category)

  const created = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        ticketCode: `TMP-${Date.now()}`,
        userId: input.userId,
        category: input.category,
        orderId: input.orderId ?? null,
        subject,
        status: 'open',
      },
    })
    const code = ticketCodeFromId(ticket.id)
    const updated = await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { ticketCode: code },
    })
    await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderRole: 'admin',
        body: input.body,
      },
    })
    return updated
  })

  void invalidateUserSupportCaches(input.userId, created.ticketCode)

  return getSupportTicket(created.id)
}

export async function replySupportTicket(id: number, input: ReplyTicketInput) {
  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        senderRole: 'admin',
        body: input.body,
      },
    }),
    prisma.supportTicket.update({
      where: { id },
      data: {
        status: input.status ?? 'answered',
        updatedAt: new Date(),
      },
    }),
  ])

  await afterAdminTicketReply(id)
  return getSupportTicket(id)
}
