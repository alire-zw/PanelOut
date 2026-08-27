import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { createShopGatewayPaymentWithWallet } from '../payments/mixed-gateway-payment.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import {
  createReactionOrderForUser,
  type ReactionOrderItemRecord,
} from '../orders/order.service.js'
import {
  calcReactionItemToman,
  getPowerTelServicesMap,
} from './reaction-pricing.js'
import { applyProductPricing } from '../pricing/product-pricing.apply.js'
import {
  fulfillReactionOrder,
  ReactionPurchaseError,
} from './reaction-purchase.fulfillment.js'
import type { ReactionPurchaseBody } from './reaction.schema.js'

async function assertPurchasePrice(input: ReactionPurchaseBody): Promise<{
  toman: number
  quantity: number
  items: ReactionOrderItemRecord[]
}> {
  const { byId } = await getPowerTelServicesMap()
  const items: ReactionOrderItemRecord[] = []
  let baseTotal = 0
  let quantity = 0

  for (const reaction of input.reactions) {
    const service = byId.get(reaction.serviceId)
    if (!service) {
      throw new ReactionPurchaseError('سرویس ری‌اکشن در دسترس نیست', 'SERVICE_UNAVAILABLE')
    }

    if (reaction.quantity < service.min || reaction.quantity > service.max) {
      throw new ReactionPurchaseError(
        `تعداد ری‌اکشن ${reaction.emoji} خارج از محدوده مجاز است`,
        'INVALID_QUANTITY',
      )
    }

    if (Math.round(service.rate) !== Math.round(reaction.rate)) {
      throw new ReactionPurchaseError(
        'قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.',
        'PRICE_CHANGED',
      )
    }

    const itemToman = calcReactionItemToman(reaction.quantity, service.rate)
    baseTotal += itemToman
    quantity += reaction.quantity
    items.push({
      serviceId: reaction.serviceId,
      emoji: reaction.emoji,
      quantity: reaction.quantity,
      rate: service.rate,
      toman: itemToman,
    })
  }

  const total = await applyProductPricing('reaction', baseTotal)

  if (total !== input.toman) {
    throw new ReactionPurchaseError(
      'قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.',
      'PRICE_CHANGED',
    )
  }

  return { toman: total, quantity, items }
}

export async function purchaseReactionWithWallet(user: DbUser, input: ReactionPurchaseBody) {
  const { toman, quantity, items } = await assertPurchasePrice(input)
  const amount = BigInt(toman)

  const order = await createReactionOrderForUser(user, {
    paymentMethod: 'wallet',
    amountToman: toman,
    walletAmountToman: toman,
    quantity,
    post: input.post,
    items,
  })

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (!current || current.balance < amount) {
      throw new ReactionPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: amount },
      },
    })
  })

  try {
    await fulfillReactionOrder(order.orderId)
  } catch (error) {
    await prisma.user.update({
      where: { id: user.id },
      data: { balance: { increment: amount } },
    })
    throw error
  }

  void invalidateWalletTransactionsCache(user.id)

  return {
    orderId: order.orderId,
    toman,
    quantity,
  }
}

export async function createReactionGatewayPayment(user: DbUser, input: ReactionPurchaseBody) {
  const { toman, quantity, items } = await assertPurchasePrice(input)

  const result = await createShopGatewayPaymentWithWallet({
    user,
    toman,
    useWalletBalance: input.useWalletBalance,
    description: `خرید ری‌اکشن ${input.post.title}`,
    createOrder: (walletAmountToman) =>
      createReactionOrderForUser(user, {
        paymentMethod: 'zibal',
        amountToman: toman,
        walletAmountToman,
        quantity,
        post: input.post,
        items,
      }),
    purchaseFullyWithWallet: () =>
      purchaseReactionWithWallet(user, { ...input, useWalletBalance: undefined }),
    throwInsufficientBalance: () => {
      throw new ReactionPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    },
  })

  return { ...result, quantity }
}

export { ReactionPurchaseError } from './reaction-purchase.fulfillment.js'
