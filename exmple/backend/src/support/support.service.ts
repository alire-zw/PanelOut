import { prisma } from '../db/client.js'
import type { CreateUserTicketInput, ReplyUserTicketInput } from './support.schema.js'
import {
  serializeTicketMessage,
  serializeTicketSummary,
  subjectFromCategory,
  ticketCodeFromId,
} from './support.serializer.js'
import { notifySupportTicketCreated } from '../bot/notifications/support-ticket-created.js'
import { notifyAdminTicketReport } from '../bot/notifications/admin-ticket-report.js'
import { notifySupportTicketAnswered } from '../bot/notifications/support-ticket-answered.js'
import {
  buildTicketDetailVersion,
  invalidateUserSupportCaches,
  readCachedTicketDetail,
  writeCachedTicketDetail,
} from './support-tickets.service.js'

export class SupportError extends Error {
  constructor(
    message: string,
    readonly code: 'NotFound' | 'Forbidden' | 'BadRequest' | 'Conflict' = 'BadRequest',
  ) {
    super(message)
    this.name = 'SupportError'
  }
}

export async function listUserSupportOrders(userId: number, limit = 30) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      category: { select: { slug: true, label: true } },
    },
  })

  return {
    items: orders.map((order) => ({
      orderId: order.orderId,
      status: order.status,
      amountToman: order.amountToman.toString(),
      category: {
        slug: order.category.slug,
        label: order.category.label,
      },
      createdAt: order.createdAt.toISOString(),
    })),
  }
}

/** @deprecated Prefer getSupportTicketsCached — kept for direct Prisma reads if needed */
export async function listUserTickets(userId: number) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  return {
    items: tickets.map((ticket) => serializeTicketSummary(ticket)),
  }
}

async function findOwnedTicket(userId: number, idOrCode: string) {
  const asId = Number.parseInt(idOrCode, 10)
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      userId,
      OR: [
        { ticketCode: idOrCode },
        ...(Number.isFinite(asId) && String(asId) === idOrCode ? [{ id: asId }] : []),
      ],
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      order: {
        select: {
          orderId: true,
          status: true,
          amountToman: true,
          category: { select: { slug: true, label: true } },
        },
      },
    },
  })
  return ticket
}

function serializeOwnedTicket(
  ticket: NonNullable<Awaited<ReturnType<typeof findOwnedTicket>>>,
) {
  return {
    ...serializeTicketSummary(ticket),
    order: ticket.order
      ? {
          orderId: ticket.order.orderId,
          status: ticket.order.status,
          amountToman: ticket.order.amountToman.toString(),
          category: ticket.order.category,
        }
      : null,
    messages: ticket.messages.map(serializeTicketMessage),
  }
}

export async function getUserTicket(userId: number, idOrCode: string) {
  const cached = await readCachedTicketDetail(userId, idOrCode)
  if (cached) {
    return { ticket: cached.ticket, version: cached.version, cachedAt: cached.cachedAt }
  }

  // Also try by resolving code first when idOrCode is numeric id
  const ticket = await findOwnedTicket(userId, idOrCode)
  if (!ticket) {
    throw new SupportError('تیکت پیدا نشد', 'NotFound')
  }

  // Re-check cache under canonical ticketCode
  if (ticket.ticketCode !== idOrCode) {
    const byCode = await readCachedTicketDetail(userId, ticket.ticketCode)
    if (byCode) {
      return { ticket: byCode.ticket, version: byCode.version, cachedAt: byCode.cachedAt }
    }
  }

  const serialized = serializeOwnedTicket(ticket)
  const stored = await writeCachedTicketDetail(
    userId,
    ticket.ticketCode,
    ticket.id,
    serialized,
  )

  return {
    ticket: stored.ticket,
    version: stored.version,
    cachedAt: stored.cachedAt,
  }
}

export async function syncUserTicket(
  userId: number,
  idOrCode: string,
  clientVersion?: string,
) {
  const asId = Number.parseInt(idOrCode, 10)
  const meta = await prisma.supportTicket.findFirst({
    where: {
      userId,
      OR: [
        { ticketCode: idOrCode },
        ...(Number.isFinite(asId) && String(asId) === idOrCode ? [{ id: asId }] : []),
      ],
    },
    select: { id: true, ticketCode: true },
  })
  if (!meta) {
    throw new SupportError('تیکت پیدا نشد', 'NotFound')
  }

  const version = await buildTicketDetailVersion(meta.id)
  const cached = await readCachedTicketDetail(userId, meta.ticketCode)

  const isUpToDate =
    cached &&
    cached.version === version &&
    (!clientVersion || clientVersion === version)

  if (isUpToDate) {
    return {
      changed: false,
      version: cached.version,
      cachedAt: cached.cachedAt,
      ticket: cached.ticket,
    }
  }

  const ticket = await findOwnedTicket(userId, meta.ticketCode)
  if (!ticket) {
    throw new SupportError('تیکت پیدا نشد', 'NotFound')
  }

  const serialized = serializeOwnedTicket(ticket)
  const stored = await writeCachedTicketDetail(
    userId,
    ticket.ticketCode,
    ticket.id,
    serialized,
  )

  return {
    changed: !clientVersion || clientVersion !== stored.version,
    version: stored.version,
    cachedAt: stored.cachedAt,
    ticket: stored.ticket,
  }
}

export async function createUserTicket(userId: number, input: CreateUserTicketInput) {
  if (input.orderId) {
    const order = await prisma.order.findFirst({
      where: { orderId: input.orderId, userId },
      select: { id: true },
    })
    if (!order) {
      throw new SupportError('سفارش انتخاب‌شده معتبر نیست', 'BadRequest')
    }
  }

  const subject = subjectFromCategory(input.category)

  const created = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        ticketCode: `TMP-${Date.now()}`,
        userId,
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
        senderRole: 'user',
        body: input.body?.trim() || (input.imageData ? '📷 تصویر' : ''),
        ...(input.imageData ? { imageData: input.imageData } : {}),
      } as Parameters<typeof tx.supportTicketMessage.create>[0]['data'],
    })
    return updated
  })

  void invalidateUserSupportCaches(userId, created.ticketCode)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      realName: true,
    },
  })

  if (user) {
    void notifySupportTicketCreated({
      telegramId: user.telegramId,
      ticketCode: created.ticketCode,
      category: created.category,
      orderId: created.orderId,
    })

    void notifyAdminTicketReport({
      ticketCode: created.ticketCode,
      category: created.category,
      orderId: created.orderId,
      user,
    })
  }

  return getUserTicket(userId, created.ticketCode)
}

export async function replyUserTicket(
  userId: number,
  idOrCode: string,
  input: ReplyUserTicketInput,
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      userId,
      OR: [{ ticketCode: idOrCode }, ...(/^\d+$/.test(idOrCode) ? [{ id: Number(idOrCode) }] : [])],
    },
  })
  if (!ticket) {
    throw new SupportError('تیکت پیدا نشد', 'NotFound')
  }
  if (ticket.status === 'closed') {
    throw new SupportError('این تیکت بسته شده است', 'Conflict')
  }

  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderRole: 'user',
        body: input.body?.trim() || (input.imageData ? '📷 تصویر' : ''),
        ...(input.imageData ? { imageData: input.imageData } : {}),
      } as Parameters<typeof prisma.supportTicketMessage.create>[0]['data'],
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: ticket.status === 'answered' ? 'open' : ticket.status,
        updatedAt: new Date(),
      },
    }),
  ])

  void invalidateUserSupportCaches(userId, ticket.ticketCode)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      realName: true,
    },
  })

  if (user) {
    void notifyAdminTicketReport({
      kind: 'reply',
      ticketCode: ticket.ticketCode,
      category: ticket.category,
      orderId: ticket.orderId,
      user,
    })
  }

  return getUserTicket(userId, ticket.ticketCode)
}

/** Called after admin replies — sends Telegram notice. */
export async function afterAdminTicketReply(ticketId: number) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, telegramId: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!ticket || !ticket.messages[0] || ticket.messages[0].senderRole !== 'admin') return

  void invalidateUserSupportCaches(ticket.user.id, ticket.ticketCode)

  void notifySupportTicketAnswered({
    telegramId: ticket.user.telegramId,
    ticketCode: ticket.ticketCode,
    category: ticket.category,
    preview: ticket.messages[0].body.slice(0, 120),
  })
}
