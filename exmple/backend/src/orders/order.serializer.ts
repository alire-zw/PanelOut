import type { Prisma } from '@prisma/client'
import type { ReactionOrderItemRecord } from './order.service.js'

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    category: true
    virtualNumber: true
    reactionOrder: true
    channelViewOrder: true
    telegramMemberOrder: true
    accountShopOrder: true
  }
}>

type OrderWithCategory = Prisma.OrderGetPayload<{
  include: { category: true }
}>

export interface SerializedVirtualNumber {
  number: string
  country: string
  range: string
  service: string
  quality: string
  providerOrderId: string
  price: string
  code: string | null
  loggedOutAt: string | null
}

export interface SerializedReactionOrder {
  postLink: string
  postUsername: string
  postMessageId: number
  postTitle: string
  postPreview: string | null
  postPhoto: string | null
  items: ReactionOrderItemRecord[]
}

export interface SerializedChannelViewOrder {
  postLink: string
  postUsername: string
  postMessageId: number
  postTitle: string
  postPreview: string | null
  postPhoto: string | null
  serviceId: number
  quantity: number
  rate: number
  toman: number
  providerOrderId: string | null
}

export interface SerializedTelegramMemberOrder {
  channelLink: string
  channelUsername: string
  channelTitle: string
  channelPhoto: string | null
  channelSubscribers: string | null
  serviceId: number
  quantity: number
  rate: number
  toman: number
  providerOrderId: string | null
}

export interface SerializedAccountShopOrder {
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
  toman: number
  status: 'registered' | 'processing' | 'delivered'
  deliveryNote: string | null
  deliveredAt: string | null
}

export interface SerializedOrder {
  orderId: string
  status: OrderWithCategory['status']
  paymentMethod: OrderWithCategory['paymentMethod']
  amountToman: string
  walletAmountToman: string
  gatewayAmountToman: string
  quantity: number | null
  recipientUsername: string | null
  recipientName: string | null
  recipientPhoto: string | null
  category: {
    slug: string
    label: string
  }
  virtualNumber: SerializedVirtualNumber | null
  reactionOrder: SerializedReactionOrder | null
  channelViewOrder: SerializedChannelViewOrder | null
  telegramMemberOrder: SerializedTelegramMemberOrder | null
  accountShopOrder: SerializedAccountShopOrder | null
  createdAt: string
  fulfilledAt: string | null
  failedAt: string | null
}

function serializeVirtualNumber(
  item: NonNullable<OrderWithRelations['virtualNumber']>,
): SerializedVirtualNumber {
  return {
    number: item.number,
    country: item.country,
    range: item.range,
    service: item.service,
    quality: item.quality,
    providerOrderId: item.providerOrderId,
    price: item.price.toString(),
    code: item.code,
    loggedOutAt: item.loggedOutAt?.toISOString() ?? null,
  }
}

function parseReactionItems(value: unknown): ReactionOrderItemRecord[] {
  if (!Array.isArray(value)) return []

  const items: ReactionOrderItemRecord[] = []

  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const serviceId = Number(record.serviceId)
    const quantity = Number(record.quantity)
    const rate = Number(record.rate)
    const toman = Number(record.toman)
    const emoji = typeof record.emoji === 'string' ? record.emoji : ''

    if (
      !Number.isFinite(serviceId) ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(rate) ||
      !emoji
    ) {
      continue
    }

    items.push({
      serviceId,
      emoji,
      quantity,
      rate,
      toman: Number.isFinite(toman) ? toman : 0,
      providerOrderId:
        typeof record.providerOrderId === 'string' ? record.providerOrderId : null,
    })
  }

  return items
}

function serializeReactionOrder(
  item: NonNullable<OrderWithRelations['reactionOrder']>,
): SerializedReactionOrder {
  return {
    postLink: item.postLink,
    postUsername: item.postUsername,
    postMessageId: item.postMessageId,
    postTitle: item.postTitle,
    postPreview: item.postPreview,
    postPhoto: item.postPhoto,
    items: parseReactionItems(item.itemsJson),
  }
}

function serializeChannelViewOrder(
  item: NonNullable<OrderWithRelations['channelViewOrder']>,
): SerializedChannelViewOrder {
  return {
    postLink: item.postLink,
    postUsername: item.postUsername,
    postMessageId: item.postMessageId,
    postTitle: item.postTitle,
    postPreview: item.postPreview,
    postPhoto: item.postPhoto,
    serviceId: item.serviceId,
    quantity: item.quantity,
    rate: item.rate,
    toman: item.toman,
    providerOrderId: item.providerOrderId,
  }
}

function serializeTelegramMemberOrder(
  item: NonNullable<OrderWithRelations['telegramMemberOrder']>,
): SerializedTelegramMemberOrder {
  return {
    channelLink: item.channelLink,
    channelUsername: item.channelUsername,
    channelTitle: item.channelTitle,
    channelPhoto: item.channelPhoto,
    channelSubscribers: item.channelSubscribers,
    serviceId: item.serviceId,
    quantity: item.quantity,
    rate: item.rate,
    toman: item.toman,
    providerOrderId: item.providerOrderId,
  }
}

function asFieldValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw.trim()) out[key] = raw
  }
  return out
}

function asCustomFields(
  value: unknown,
): SerializedAccountShopOrder['customFields'] {
  if (!Array.isArray(value)) return []
  const fields: SerializedAccountShopOrder['customFields'] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const label = typeof row.label === 'string' ? row.label : ''
    if (!id || !label) continue
    fields.push({
      id,
      label,
      placeholder: typeof row.placeholder === 'string' ? row.placeholder : '',
      required: row.required !== false,
    })
  }
  return fields
}

function serializeAccountShopOrder(
  item: NonNullable<OrderWithRelations['accountShopOrder']>,
): SerializedAccountShopOrder {
  return {
    planId: item.planId,
    accountCategoryId: item.accountCategoryId,
    planName: item.planName,
    durationLabel: item.durationLabel,
    warrantyLabel: item.warrantyLabel,
    fieldValues: asFieldValues(item.fieldValuesJson),
    customFields: asCustomFields(item.customFieldsJson),
    toman: item.toman,
    status: item.status,
    deliveryNote: item.deliveryNote,
    deliveredAt: item.deliveredAt?.toISOString() ?? null,
  }
}

export function serializeOrder(
  order: OrderWithCategory | OrderWithRelations,
): SerializedOrder {
  const virtualNumber =
    'virtualNumber' in order && order.virtualNumber
      ? serializeVirtualNumber(order.virtualNumber)
      : null

  const reactionOrder =
    'reactionOrder' in order && order.reactionOrder
      ? serializeReactionOrder(order.reactionOrder)
      : null

  const channelViewOrder =
    'channelViewOrder' in order && order.channelViewOrder
      ? serializeChannelViewOrder(order.channelViewOrder)
      : null

  const telegramMemberOrder =
    'telegramMemberOrder' in order && order.telegramMemberOrder
      ? serializeTelegramMemberOrder(order.telegramMemberOrder)
      : null

  const accountShopOrder =
    'accountShopOrder' in order && order.accountShopOrder
      ? serializeAccountShopOrder(order.accountShopOrder)
      : null

  return {
    orderId: order.orderId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    amountToman: order.amountToman.toString(),
    walletAmountToman: order.walletAmountToman.toString(),
    gatewayAmountToman: (order.amountToman - order.walletAmountToman).toString(),
    quantity: order.quantity,
    recipientUsername: order.recipientUsername,
    recipientName: order.recipientName,
    recipientPhoto: order.recipientPhoto,
    category: {
      slug: order.category.slug,
      label: order.category.label,
    },
    virtualNumber,
    reactionOrder,
    channelViewOrder,
    telegramMemberOrder,
    accountShopOrder,
    createdAt: order.createdAt.toISOString(),
    fulfilledAt: order.fulfilledAt?.toISOString() ?? null,
    failedAt: order.failedAt?.toISOString() ?? null,
  }
}
