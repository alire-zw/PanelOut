import { prisma } from '../db/client.js'
import { invalidateUserOrdersCache } from '../orders/user-orders.cache.js'
import {
  fetchCallinooVerificationCode,
  logoutCallinooTelegramAccount,
  type CallinooLogoutStatus,
  type CallinooVerificationCodeStatus,
} from './callinoo.client.js'
import { VirtualNumberPurchaseError } from './virtual-number-purchase.fulfillment.js'

export type VirtualNumberCodeResponse = {
  status: CallinooVerificationCodeStatus
  message: string
  orderId: string
  code: string | null
}

export type VirtualNumberLogoutResponse = {
  status: CallinooLogoutStatus
  message: string
  orderId: string
  loggedOutAt: string | null
}

async function markVirtualNumberLoggedOut(orderDbId: number, userId: number): Promise<Date> {
  const loggedOutAt = new Date()
  await prisma.virtualNumber.update({
    where: { orderDbId },
    data: {
      loggedOutAt,
      code: null,
      codeReceivedAt: null,
    },
  })
  await prisma.order.update({
    where: { id: orderDbId },
    data: { updatedAt: new Date() },
  })
  void invalidateUserOrdersCache(userId)
  return loggedOutAt
}

export async function getVirtualNumberVerificationCode(
  userId: number,
  orderId: string,
): Promise<VirtualNumberCodeResponse> {
  const order = await prisma.order.findFirst({
    where: {
      orderId,
      userId,
    },
    include: {
      category: true,
      virtualNumber: true,
    },
  })

  if (!order || order.category.slug !== 'virtual-number' || !order.virtualNumber) {
    throw new VirtualNumberPurchaseError('سفارش یافت نشد', 'ORDER_NOT_FOUND')
  }

  if (order.virtualNumber.loggedOutAt) {
    return {
      status: 'logged_out',
      message: 'از این شماره خارج شده‌اید',
      orderId: order.orderId,
      code: null,
    }
  }

  const result = await fetchCallinooVerificationCode(order.virtualNumber.providerOrderId)

  if (result.status === 'logged_out') {
    await markVirtualNumberLoggedOut(order.id, userId)
    return {
      status: 'logged_out',
      message: result.message || 'لوگ‌اوت شده',
      orderId: order.orderId,
      code: null,
    }
  }

  if (result.status === 'ready') {
    const code = String(result.data?.code ?? '').trim()
    if (!code) {
      return {
        status: 'pending',
        message: 'در انتظار کد',
        orderId: order.orderId,
        code: null,
      }
    }

    await prisma.virtualNumber.update({
      where: { orderDbId: order.id },
      data: {
        code,
        codeReceivedAt: new Date(),
      },
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { updatedAt: new Date() },
    })
    void invalidateUserOrdersCache(userId)

    return {
      status: 'ready',
      message: result.message || 'کد دریافت شد',
      orderId: order.orderId,
      code,
    }
  }

  return {
    status: result.status,
    message: result.message,
    orderId: order.orderId,
    code: null,
  }
}

export async function logoutVirtualNumberTelegramAccount(
  userId: number,
  orderId: string,
): Promise<VirtualNumberLogoutResponse> {
  const order = await prisma.order.findFirst({
    where: {
      orderId,
      userId,
    },
    include: {
      category: true,
      virtualNumber: true,
    },
  })

  if (!order || order.category.slug !== 'virtual-number' || !order.virtualNumber) {
    throw new VirtualNumberPurchaseError('سفارش یافت نشد', 'ORDER_NOT_FOUND')
  }

  if (order.virtualNumber.loggedOutAt) {
    return {
      status: 'logged_out',
      message: 'قبلاً از این شماره خارج شده‌اید',
      orderId: order.orderId,
      loggedOutAt: order.virtualNumber.loggedOutAt.toISOString(),
    }
  }

  const result = await logoutCallinooTelegramAccount(order.virtualNumber.providerOrderId)

  if (result.status === 'logged_out') {
    const loggedOutAt = await markVirtualNumberLoggedOut(order.id, userId)
    return {
      status: 'logged_out',
      message: result.message || 'خروج از اکانت انجام شد',
      orderId: order.orderId,
      loggedOutAt: loggedOutAt.toISOString(),
    }
  }

  return {
    status: result.status,
    message: result.message,
    orderId: order.orderId,
    loggedOutAt: null,
  }
}
