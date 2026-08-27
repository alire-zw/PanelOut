import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { getOnlineStats } from '../analytics/presence.service.js'
import { listProductViewStats } from '../analytics/product-views.service.js'
import { serializeOrder } from '../orders/order.serializer.js'
import { serializePayment } from '../payments/payment.serializer.js'
import type {
  ListAdminCryptoPaymentsQuery,
  ListAdminOrdersQuery,
  ListAdminPaymentsQuery,
  ListAdminTransfersQuery,
} from './admin.schema.js'
import {
  addOrderToProfitBucket,
  emptyProfitBucket,
  estimateOrderCostToman,
  serializeProfitBucket,
  type ProfitBucket,
} from './admin-profit.js'

/** Paid revenue: completed orders + paid account-shop orders still in fulfillment. */
const paidSalesWhere: Prisma.OrderWhereInput = {
  OR: [
    { status: 'completed' },
    { status: 'processing', category: { slug: 'chatgpt' } },
  ],
}

function pendingOrdersWhere(extra: Prisma.OrderWhereInput = {}): Prisma.OrderWhereInput {
  return {
    ...extra,
    OR: [
      { status: 'pending' },
      { status: 'processing', NOT: { category: { slug: 'chatgpt' } } },
    ],
  }
}

function getTehranDayStart(date = new Date()): Date {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

  return new Date(`${day}T00:00:00+03:30`)
}

function serializeAdminUserSummary(user: {
  id: number
  telegramId: bigint
  username: string | null
  firstName: string | null
  lastName: string | null
}) {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
  }
}

export async function getAdminOverview() {
  const dayStart = getTehranDayStart()
  const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(dayStart.getTime() - 29 * 24 * 60 * 60 * 1000)

  const [
    online,
    productViews,
    todayOrders,
    completedAgg,
    failedCount,
    pendingCount,
    salesByCategoryToday,
    bestSellersAllTime,
    usersTotal,
    usersBanned,
    usersKycPending,
    usersNewToday,
    usersNewWeek,
    transfersToday,
    ordersTotal,
    ordersCompletedTotal,
    latestOrders,
    weekCompletedOrders,
    monthCompletedOrders,
    profitOrders,
    pricingRules,
    accountPlans,
    openTicketsCount,
  ] = await Promise.all([
    getOnlineStats(),
    listProductViewStats(),
    prisma.order.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: dayStart }, ...paidSalesWhere },
      _sum: { amountToman: true },
      _count: true,
    }),
    prisma.order.count({ where: { createdAt: { gte: dayStart }, status: 'failed' } }),
    prisma.order.count({
      where: pendingOrdersWhere({ createdAt: { gte: dayStart } }),
    }),
    prisma.order.groupBy({
      by: ['categoryId'],
      where: { createdAt: { gte: dayStart }, ...paidSalesWhere },
      _sum: { amountToman: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ['categoryId'],
      where: paidSalesWhere,
      _sum: { amountToman: true },
      _count: true,
    }),
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { kycVerifiedAt: null, isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.transfer.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.order.count(),
    prisma.order.count({ where: paidSalesWhere }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { slug: true, label: true } },
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: weekStart }, ...paidSalesWhere },
      select: { amountToman: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: monthStart }, ...paidSalesWhere },
      select: { amountToman: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: monthStart }, ...paidSalesWhere },
      select: {
        amountToman: true,
        createdAt: true,
        category: { select: { id: true, slug: true, label: true } },
        virtualNumber: { select: { price: true } },
        reactionOrder: { select: { itemsJson: true } },
        channelViewOrder: { select: { quantity: true, rate: true } },
        telegramMemberOrder: { select: { quantity: true, rate: true } },
        accountShopOrder: { select: { planId: true } },
      },
    }),
    prisma.productPricing.findMany({
      select: {
        productKey: true,
        markupPercent: true,
        fixedAddToman: true,
        isActive: true,
      },
    }),
    prisma.accountShopPlan.findMany({
      select: { id: true, pricingMode: true, markupPercent: true },
    }),
    prisma.supportTicket.count({ where: { status: 'open' } }),
  ])

  const categoryIds = [
    ...new Set([
      ...salesByCategoryToday.map((row) => row.categoryId),
      ...bestSellersAllTime.map((row) => row.categoryId),
    ]),
  ]
  const categories = await prisma.shopCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, slug: true, label: true },
  })
  const categoryMap = new Map(categories.map((item) => [item.id, item]))

  const mapCategorySales = (
    rows: Array<{ categoryId: number; _count: number; _sum: { amountToman: bigint | null } }>,
  ) =>
    rows
      .map((row) => {
        const category = categoryMap.get(row.categoryId)
        return {
          categoryId: row.categoryId,
          slug: category?.slug ?? 'unknown',
          label: category?.label ?? 'نامشخص',
          count: row._count,
          amountToman: (row._sum.amountToman ?? 0n).toString(),
        }
      })
      .sort((a, b) => Number(b.amountToman) - Number(a.amountToman))

  const tehranDayKey = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)

  const buildSeries = (
    orders: Array<{ amountToman: bigint; createdAt: Date }>,
    days: number,
    start: Date,
  ) => {
    const buckets = Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000)
      return { day: tehranDayKey(date), amountToman: 0, count: 0 }
    })
    const indexByDay = new Map(buckets.map((bucket, index) => [bucket.day, index]))

    for (const order of orders) {
      const key = tehranDayKey(order.createdAt)
      const index = indexByDay.get(key)
      if (index === undefined) continue
      const bucket = buckets[index]
      if (!bucket) continue
      bucket.amountToman += Number(order.amountToman)
      bucket.count += 1
    }

    return buckets.map((bucket) => ({
      day: bucket.day,
      amountToman: String(bucket.amountToman),
      count: bucket.count,
    }))
  }

  const pricingByKey = new Map(
    pricingRules.map((row) => [
      row.productKey,
      {
        markupPercent: row.markupPercent,
        fixedAddToman: Number(row.fixedAddToman),
        isActive: row.isActive,
      },
    ]),
  )
  const planById = new Map(
    accountPlans.map((row) => [
      row.id,
      { pricingMode: row.pricingMode, markupPercent: row.markupPercent },
    ]),
  )

  const todayProfit = emptyProfitBucket()
  const weekProfit = emptyProfitBucket()
  const monthProfit = emptyProfitBucket()
  const byCategory = new Map<
    string,
    ProfitBucket & { slug: string; label: string; categoryId: number }
  >()
  const profitDayBuckets = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(monthStart.getTime() + index * 24 * 60 * 60 * 1000)
    return {
      day: tehranDayKey(date),
      ...emptyProfitBucket(),
    }
  })
  const profitDayIndex = new Map(profitDayBuckets.map((bucket, index) => [bucket.day, index]))

  for (const order of profitOrders) {
    const revenue = Number(order.amountToman)
    const slug = order.category.slug
    const planId = order.accountShopOrder?.planId
    const cost = estimateOrderCostToman({
      slug,
      amountToman: revenue,
      virtualNumberPrice: order.virtualNumber ? Number(order.virtualNumber.price) : null,
      reactionItemsJson: order.reactionOrder?.itemsJson,
      channelView: order.channelViewOrder
        ? {
            quantity: order.channelViewOrder.quantity,
            rate: order.channelViewOrder.rate,
          }
        : null,
      telegramMember: order.telegramMemberOrder
        ? {
            quantity: order.telegramMemberOrder.quantity,
            rate: order.telegramMemberOrder.rate,
          }
        : null,
      accountPlan: planId != null ? (planById.get(planId) ?? null) : null,
      pricingRule: pricingByKey.get(slug) ?? null,
    })

    addOrderToProfitBucket(monthProfit, revenue, cost)
    if (order.createdAt >= weekStart) {
      addOrderToProfitBucket(weekProfit, revenue, cost)
    }
    if (order.createdAt >= dayStart) {
      addOrderToProfitBucket(todayProfit, revenue, cost)
    }

    const catKey = slug
    let cat = byCategory.get(catKey)
    if (!cat) {
      cat = {
        slug,
        label: order.category.label,
        categoryId: order.category.id,
        ...emptyProfitBucket(),
      }
      byCategory.set(catKey, cat)
    }
    addOrderToProfitBucket(cat, revenue, cost)

    const dayKey = tehranDayKey(order.createdAt)
    const dayIdx = profitDayIndex.get(dayKey)
    if (dayIdx !== undefined) {
      const dayBucket = profitDayBuckets[dayIdx]
      if (dayBucket) addOrderToProfitBucket(dayBucket, revenue, cost)
    }
  }

  const serializeProfitSeries = (days: number, start: Date) => {
    const startKey = tehranDayKey(start)
    const startIdx = profitDayIndex.get(startKey) ?? Math.max(0, 30 - days)
    return profitDayBuckets.slice(startIdx, startIdx + days).map((bucket) => ({
      day: bucket.day,
      revenueToman: String(Math.round(bucket.revenueToman)),
      costToman: String(Math.round(bucket.costToman)),
      profitToman: String(Math.round(bucket.profitToman)),
      count: bucket.orderCount,
    }))
  }

  return {
    online,
    productViews: {
      totals: productViews.totals,
      daily: productViews.daily.slice(0, 60),
    },
    users: {
      total: usersTotal,
      banned: usersBanned,
      kycPending: usersKycPending,
      newToday: usersNewToday,
      newWeek: usersNewWeek,
    },
    tickets: {
      openCount: openTicketsCount,
    },
    totals: {
      orders: ordersTotal,
      completedOrders: ordersCompletedTotal,
    },
    today: {
      ordersCount: todayOrders,
      completedCount: completedAgg._count,
      completedAmountToman: (completedAgg._sum.amountToman ?? 0n).toString(),
      failedCount,
      pendingCount,
      transfersCount: transfersToday,
      dayStart: dayStart.toISOString(),
      salesByCategory: mapCategorySales(salesByCategoryToday),
    },
    bestSellers: mapCategorySales(bestSellersAllTime).slice(0, 8),
    latestOrders: latestOrders.map((order) => ({
      orderId: order.orderId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      amountToman: order.amountToman.toString(),
      category: order.category,
      user: serializeAdminUserSummary(order.user),
      createdAt: order.createdAt.toISOString(),
    })),
    charts: {
      weekly: buildSeries(weekCompletedOrders, 7, weekStart),
      monthly: buildSeries(monthCompletedOrders, 30, monthStart),
    },
    profit: {
      today: serializeProfitBucket(todayProfit),
      week: serializeProfitBucket(weekProfit),
      month: serializeProfitBucket(monthProfit),
      byCategory: [...byCategory.values()]
        .map((row) => ({
          categoryId: row.categoryId,
          slug: row.slug,
          label: row.label,
          ...serializeProfitBucket(row),
        }))
        .sort((a, b) => Number(b.profitToman) - Number(a.profitToman)),
      charts: {
        weekly: serializeProfitSeries(7, weekStart),
        monthly: serializeProfitSeries(30, monthStart),
      },
    },
  }
}

export async function listAdminOrders(query: ListAdminOrdersQuery) {
  const where: Prisma.OrderWhereInput = {}

  if (query.status) {
    where.status = query.status
  }

  if (query.categorySlug) {
    where.category = { slug: query.categorySlug }
  }

  if (query.search) {
    const search = query.search
    const asDigits = /^\d+$/.test(search)
    const telegramId = asDigits ? BigInt(search) : null
    const asUserId = asDigits ? Number.parseInt(search, 10) : NaN
    where.OR = [
      { orderId: { contains: search } },
      { recipientUsername: { contains: search } },
      { user: { username: { contains: search } } },
      ...(telegramId !== null ? [{ user: { telegramId } }] : []),
      ...(Number.isSafeInteger(asUserId) ? [{ user: { id: asUserId } }] : []),
    ]
  }

  const skip = (query.page - 1) * query.limit

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: {
        category: true,
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ])

  return {
    items: items.map((order) => ({
      orderId: order.orderId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      amountToman: order.amountToman.toString(),
      walletAmountToman: order.walletAmountToman.toString(),
      gatewayAmountToman: (order.amountToman - order.walletAmountToman).toString(),
      quantity: order.quantity,
      recipientUsername: order.recipientUsername,
      category: {
        slug: order.category.slug,
        label: order.category.label,
      },
      user: serializeAdminUserSummary(order.user),
      createdAt: order.createdAt.toISOString(),
      fulfilledAt: order.fulfilledAt?.toISOString() ?? null,
      failedAt: order.failedAt?.toISOString() ?? null,
    })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function getAdminOrderByOrderId(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: {
      category: true,
      user: {
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isBanned: true,
          isActive: true,
        },
      },
      payment: true,
      cryptoPayment: {
        select: {
          orderId: true,
          amountToman: true,
          amountTrx: true,
          status: true,
          incomingTxHash: true,
          verifiedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      },
      virtualNumber: true,
      reactionOrder: true,
      channelViewOrder: true,
      telegramMemberOrder: true,
      accountShopOrder: true,
    },
  })

  if (!order) return null

  return {
    order: serializeOrder(order),
    user: {
      ...serializeAdminUserSummary(order.user),
      role: order.user.role,
      isBanned: order.user.isBanned,
      isActive: order.user.isActive,
    },
    payment: order.payment ? serializePayment(order.payment) : null,
    cryptoPayment: order.cryptoPayment
      ? {
          orderId: order.cryptoPayment.orderId,
          amountToman: order.cryptoPayment.amountToman.toString(),
          amountTrx: order.cryptoPayment.amountTrx,
          status: order.cryptoPayment.status,
          incomingTxHash: order.cryptoPayment.incomingTxHash,
          verifiedAt: order.cryptoPayment.verifiedAt?.toISOString() ?? null,
          expiresAt: order.cryptoPayment.expiresAt.toISOString(),
          createdAt: order.cryptoPayment.createdAt.toISOString(),
        }
      : null,
  }
}

export async function listAdminPayments(query: ListAdminPaymentsQuery) {
  const where: Prisma.PaymentWhereInput = {}

  if (query.status) {
    where.status = query.status
  }

  if (query.search) {
    const search = query.search
    const trackId = /^\d+$/.test(search) ? BigInt(search) : null
    where.OR = [
      { orderId: { contains: search } },
      { refNumber: { contains: search } },
      ...(trackId !== null ? [{ trackId }] : []),
      { user: { username: { contains: search } } },
    ]
  }

  const skip = (query.page - 1) * query.limit

  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.payment.count({ where }),
  ])

  return {
    items: items.map((payment) => ({
      ...serializePayment(payment),
      user: serializeAdminUserSummary(payment.user),
    })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function listAdminCryptoPayments(query: ListAdminCryptoPaymentsQuery) {
  const where: Prisma.CryptoPaymentWhereInput = {}

  if (query.status) {
    where.status = query.status
  }

  if (query.search) {
    const search = query.search
    where.OR = [
      { orderId: { contains: search } },
      { incomingTxHash: { contains: search } },
      { user: { username: { contains: search } } },
    ]
  }

  const skip = (query.page - 1) * query.limit

  const [items, total] = await prisma.$transaction([
    prisma.cryptoPayment.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.cryptoPayment.count({ where }),
  ])

  return {
    items: items.map((payment) => ({
      orderId: payment.orderId,
      amountToman: payment.amountToman.toString(),
      amountTrx: payment.amountTrx,
      status: payment.status,
      incomingTxHash: payment.incomingTxHash,
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      expiresAt: payment.expiresAt.toISOString(),
      createdAt: payment.createdAt.toISOString(),
      user: serializeAdminUserSummary(payment.user),
    })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function listAdminTransfers(query: ListAdminTransfersQuery) {
  const where: Prisma.TransferWhereInput = {}

  if (query.search) {
    const search = query.search
    const asDigits = /^\d+$/.test(search)
    const telegramId = asDigits ? BigInt(search) : null
    where.OR = [
      { transferId: { contains: search } },
      { sender: { username: { contains: search } } },
      { recipient: { username: { contains: search } } },
      ...(telegramId !== null
        ? [{ sender: { telegramId } }, { recipient: { telegramId } }]
        : []),
    ]
  }

  const skip = (query.page - 1) * query.limit

  const [items, total] = await prisma.$transaction([
    prisma.transfer.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        recipient: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.transfer.count({ where }),
  ])

  return {
    items: items.map((transfer) => ({
      transferId: transfer.transferId,
      amountToman: transfer.amount.toString(),
      createdAt: transfer.createdAt.toISOString(),
      sender: serializeAdminUserSummary(transfer.sender),
      recipient: serializeAdminUserSummary(transfer.recipient),
    })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}
