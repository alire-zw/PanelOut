import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { createShopGatewayPaymentWithWallet } from '../payments/mixed-gateway-payment.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import {
  createChannelViewsOrderForUser,
} from '../orders/order.service.js'
import { getPowerTelServicesMap } from '../reaction/reaction-pricing.js'
import {
  calcChannelViewsToman,
  CHANNEL_VIEW_SERVICE_ID,
} from './channel-views.pricing.js'
import { applyProductPricing } from '../pricing/product-pricing.apply.js'
import {
  ChannelViewsPurchaseError,
  fulfillChannelViewsOrder,
} from './channel-views-purchase.fulfillment.js'
import type { ChannelViewsPurchaseBody } from './channel-views.schema.js'

async function assertPurchasePrice(input: ChannelViewsPurchaseBody): Promise<{
  toman: number
  quantity: number
  rate: number
}> {
  if (input.serviceId !== CHANNEL_VIEW_SERVICE_ID) {
    throw new ChannelViewsPurchaseError('سرویس بازدید نامعتبر است', 'INVALID_SERVICE')
  }

  const { byId } = await getPowerTelServicesMap()
  const service = byId.get(CHANNEL_VIEW_SERVICE_ID)

  if (!service) {
    throw new ChannelViewsPurchaseError('سرویس بازدید در دسترس نیست', 'SERVICE_UNAVAILABLE')
  }

  if (input.quantity < service.min || input.quantity > service.max) {
    throw new ChannelViewsPurchaseError(
      'تعداد بازدید خارج از محدوده مجاز است',
      'INVALID_QUANTITY',
    )
  }

  if (Math.round(service.rate) !== Math.round(input.rate)) {
    throw new ChannelViewsPurchaseError(
      'قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.',
      'PRICE_CHANGED',
    )
  }

  const baseToman = calcChannelViewsToman(input.quantity, service.rate)
  const toman = await applyProductPricing('channel-views', baseToman)
  if (toman !== input.toman) {
    throw new ChannelViewsPurchaseError(
      'قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.',
      'PRICE_CHANGED',
    )
  }

  return { toman, quantity: input.quantity, rate: service.rate }
}

export async function purchaseChannelViewsWithWallet(
  user: DbUser,
  input: ChannelViewsPurchaseBody,
) {
  const { toman, quantity, rate } = await assertPurchasePrice(input)
  const amount = BigInt(toman)

  const order = await createChannelViewsOrderForUser(user, {
    paymentMethod: 'wallet',
    amountToman: toman,
    walletAmountToman: toman,
    quantity,
    rate,
    serviceId: CHANNEL_VIEW_SERVICE_ID,
    post: input.post,
  })

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (!current || current.balance < amount) {
      throw new ChannelViewsPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: amount },
      },
    })
  })

  try {
    await fulfillChannelViewsOrder(order.orderId)
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

export async function createChannelViewsGatewayPayment(
  user: DbUser,
  input: ChannelViewsPurchaseBody,
) {
  const { toman, quantity, rate } = await assertPurchasePrice(input)

  const result = await createShopGatewayPaymentWithWallet({
    user,
    toman,
    useWalletBalance: input.useWalletBalance,
    description: `خرید سین کانال ${input.post.title}`,
    createOrder: (walletAmountToman) =>
      createChannelViewsOrderForUser(user, {
        paymentMethod: 'zibal',
        amountToman: toman,
        walletAmountToman,
        quantity,
        rate,
        serviceId: CHANNEL_VIEW_SERVICE_ID,
        post: input.post,
      }),
    purchaseFullyWithWallet: () =>
      purchaseChannelViewsWithWallet(user, { ...input, useWalletBalance: undefined }),
    throwInsufficientBalance: () => {
      throw new ChannelViewsPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    },
  })

  return { ...result, quantity }
}

export { ChannelViewsPurchaseError } from './channel-views-purchase.fulfillment.js'
