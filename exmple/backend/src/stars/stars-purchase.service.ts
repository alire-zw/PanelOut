import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { createCryptoPayment } from '../crypto-payments/crypto-payment.service.js'
import { createShopGatewayPaymentWithWallet } from '../payments/mixed-gateway-payment.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { createStarsOrderForUser, linkOrderCryptoPayment } from '../orders/order.service.js'
import { getStarsPriceQuote } from './stars-price.service.js'
import { fulfillStarsOrder, StarsPurchaseError } from './stars-purchase.fulfillment.js'
import type { StarsPurchaseBody } from './stars-purchase.schema.js'

async function assertPurchasePrice(input: StarsPurchaseBody): Promise<number> {
  const quote = await getStarsPriceQuote(input.quantity)

  if (quote.toman !== input.toman) {
    throw new StarsPurchaseError('قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.', 'PRICE_CHANGED')
  }

  return quote.toman
}

export async function purchaseStarsWithWallet(user: DbUser, input: StarsPurchaseBody) {
  const toman = await assertPurchasePrice(input)
  const amount = BigInt(toman)

  const order = await createStarsOrderForUser(user, {
    paymentMethod: 'wallet',
    amountToman: toman,
    walletAmountToman: toman,
    quantity: input.quantity,
    recipientUsername: input.username,
    recipientName: input.recipientName,
    recipientPhoto: input.recipientPhoto,
  })

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (!current || current.balance < amount) {
      throw new StarsPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: amount },
      },
    })
  })

  try {
    await fulfillStarsOrder(order.orderId)
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
    stars: input.quantity,
    toman,
    username: input.username,
  }
}

export async function createStarsGatewayPayment(user: DbUser, input: StarsPurchaseBody) {
  const toman = await assertPurchasePrice(input)

  return createShopGatewayPaymentWithWallet({
    user,
    toman,
    useWalletBalance: input.useWalletBalance,
    description: `خرید ${input.quantity.toLocaleString('fa-IR')} استارز برای @${input.username}`,
    createOrder: (walletAmountToman) =>
      createStarsOrderForUser(user, {
        paymentMethod: 'zibal',
        amountToman: toman,
        walletAmountToman,
        quantity: input.quantity,
        recipientUsername: input.username,
        recipientName: input.recipientName,
        recipientPhoto: input.recipientPhoto,
      }),
    purchaseFullyWithWallet: () =>
      purchaseStarsWithWallet(user, { ...input, useWalletBalance: undefined }),
    throwInsufficientBalance: () => {
      throw new StarsPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    },
  })
}

export async function createStarsCryptoPayment(user: DbUser, input: StarsPurchaseBody) {
  const toman = await assertPurchasePrice(input)
  const amount = BigInt(toman)

  const order = await createStarsOrderForUser(user, {
    paymentMethod: 'tron',
    amountToman: toman,
    quantity: input.quantity,
    recipientUsername: input.username,
    recipientName: input.recipientName,
    recipientPhoto: input.recipientPhoto,
  })

  const result = await createCryptoPayment(user, { amount })

  await linkOrderCryptoPayment(order.id, result.payment.id)

  return {
    orderId: order.orderId,
    cryptoOrderId: result.payment.orderId,
    toman: Number(toman),
  }
}

export { StarsPurchaseError } from './stars-purchase.fulfillment.js'
