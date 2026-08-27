import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import {
  AccountShopPurchaseError,
  setAccountShopOrderFulfillmentStatus,
} from '../chatgpt/account-shop-purchase.fulfillment.js'
import type {
  ListAdminAccountOrdersQuery,
  UpdateAdminAccountOrderStatusBody,
} from './admin-account-orders.schema.js'

const accountOrderInclude = {
  order: {
    include: {
      user: {
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          phoneNumber: true,
        },
      },
      payment: true,
    },
  },
} as const

type AccountOrderRow = Prisma.AccountShopOrderGetPayload<{ include: typeof accountOrderInclude }>

function serializeAdminUserSummary(user: AccountOrderRow['order']['user']) {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phoneNumber: user.phoneNumber,
  }
}

function asFieldValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw.trim()) out[key] = raw.trim()
  }
  return out
}

function asCustomFields(value: unknown): Array<{ id: string; label: string }> {
  if (!Array.isArray(value)) return []
  const fields: Array<{ id: string; label: string }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const label = typeof row.label === 'string' ? row.label : ''
    if (!id || !label) continue
    fields.push({ id, label })
  }
  return fields
}

function serializeAccountOrder(row: AccountOrderRow) {
  const fieldValues = asFieldValues(row.fieldValuesJson)
  const customFields = asCustomFields(row.customFieldsJson)
  return {
    orderId: row.order.orderId,
    fulfillmentStatus: row.status,
    orderStatus: row.order.status,
    paymentMethod: row.order.paymentMethod,
    amountToman: row.order.amountToman.toString(),
    walletAmountToman: row.order.walletAmountToman.toString(),
    gatewayAmountToman: (row.order.amountToman - row.order.walletAmountToman).toString(),
    planId: row.planId,
    planName: row.planName,
    accountCategoryId: row.accountCategoryId,
    durationLabel: row.durationLabel,
    warrantyLabel: row.warrantyLabel,
    fieldValues,
    customFields,
    filledFields: customFields
      .filter((field) => (fieldValues[field.id] ?? '').trim())
      .map((field) => ({
        id: field.id,
        label: field.label,
        value: fieldValues[field.id],
      })),
    user: serializeAdminUserSummary(row.order.user),
    payment: row.order.payment
      ? {
          orderId: row.order.payment.orderId,
          trackId: row.order.payment.trackId?.toString() ?? null,
          refNumber: row.order.payment.refNumber,
          status: row.order.payment.status,
          cardNumber: row.order.payment.cardNumber,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deliveryNote: row.deliveryNote,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    fulfilledAt: row.order.fulfilledAt?.toISOString() ?? null,
  }
}

export async function listAdminAccountOrders(query: ListAdminAccountOrdersQuery) {
  const where: Prisma.AccountShopOrderWhereInput = {
    status: query.status,
  }

  if (query.search) {
    const search = query.search
    const asDigits = /^\d+$/.test(search)
    const telegramId = asDigits ? BigInt(search) : null
    const asUserId = asDigits ? Number.parseInt(search, 10) : NaN
    where.OR = [
      { order: { orderId: { contains: search } } },
      { planName: { contains: search } },
      { accountCategoryId: { contains: search } },
      { order: { user: { username: { contains: search } } } },
      ...(telegramId !== null ? [{ order: { user: { telegramId } } }] : []),
      ...(Number.isSafeInteger(asUserId) ? [{ order: { user: { id: asUserId } } }] : []),
    ]
  }

  const skip = (query.page - 1) * query.limit

  const [rows, total] = await prisma.$transaction([
    prisma.accountShopOrder.findMany({
      where,
      include: accountOrderInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.accountShopOrder.count({ where }),
  ])

  return {
    items: rows.map((row) => serializeAccountOrder(row)),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function getAdminAccountOrderByOrderId(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { orderId },
    select: { id: true, category: { select: { slug: true } } },
  })
  if (!order || order.category.slug !== 'chatgpt') return null

  const row = await prisma.accountShopOrder.findUnique({
    where: { orderDbId: order.id },
    include: accountOrderInclude,
  })
  if (!row) return null
  return { order: serializeAccountOrder(row) }
}

export async function updateAdminAccountOrderStatus(
  orderId: string,
  body: UpdateAdminAccountOrderStatusBody,
) {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { category: true, accountShopOrder: true },
  })

  if (!order?.accountShopOrder || order.category.slug !== 'chatgpt') {
    throw new AccountShopPurchaseError('سفارش اکانت یافت نشد', 'ORDER_NOT_FOUND')
  }

  await setAccountShopOrderFulfillmentStatus(orderId, body.status, body.deliveryNote)

  const result = await getAdminAccountOrderByOrderId(orderId)
  if (!result) {
    throw new AccountShopPurchaseError('سفارش اکانت یافت نشد', 'ORDER_NOT_FOUND')
  }
  return result
}

export { AccountShopPurchaseError }
