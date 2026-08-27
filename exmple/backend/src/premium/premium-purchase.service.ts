import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { createCryptoPayment } from '../crypto-payments/crypto-payment.service.js'
import { createShopGatewayPaymentWithWallet } from '../payments/mixed-gateway-payment.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import {
  createPremiumOrderForUser,
  linkOrderCryptoPayment,
} from '../orders/order.service.js'
import { getPremiumPriceQuote } from './premium-price.service.js'
import { fulfillPremiumOrder, PremiumPurchaseError } from './premium-purchase.fulfillment.js'
import type { PremiumPurchaseBody } from './premium.schema.js'

async function assertPurchasePrice(input: PremiumPurchaseBody): Promise<number> {
  const quote = await getPremiumPriceQuote(input.months)

  if (quote.toman !== input.toman) {
    throw new PremiumPurchaseError('قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.', 'PRICE_CHANGED')
  }

  return quote.toman
}

export async function purchasePremiumWithWallet(user: DbUser, input: PremiumPurchaseBody) {
  const toman = await assertPurchasePrice(input)
  const amount = BigInt(toman)

  const order = await createPremiumOrderForUser(user, {
    paymentMethod: 'wallet',
    amountToman: toman,
    walletAmountToman: toman,
    months: input.months,
    recipientUsername: input.username,
    recipientName: input.recipientName,
    recipientPhoto: input.recipientPhoto,
  })

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (!current || current.balance < amount) {
      throw new PremiumPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: amount },
      },
    })
  })

  try {
    await fulfillPremiumOrder(order.orderId)
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
    months: input.months,
    toman,
    username: input.username,
  }
}

export async function createPremiumGatewayPayment(user: DbUser, input: PremiumPurchaseBody) {
  const toman = await assertPurchasePrice(input)

  return createShopGatewayPaymentWithWallet({
    user,
    toman,
    useWalletBalance: input.useWalletBalance,
    description: `خرید پریمیوم ${input.months} ماهه برای @${input.username}`,
    createOrder: (walletAmountToman) =>
      createPremiumOrderForUser(user, {
        paymentMethod: 'zibal',
        amountToman: toman,
        walletAmountToman,
        months: input.months,
        recipientUsername: input.username,
        recipientName: input.recipientName,
        recipientPhoto: input.recipientPhoto,
      }),
    purchaseFullyWithWallet: () =>
      purchasePremiumWithWallet(user, { ...input, useWalletBalance: undefined }),
    throwInsufficientBalance: () => {
      throw new PremiumPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    },
  })
}

export async function createPremiumCryptoPayment(user: DbUser, input: PremiumPurchaseBody) {
  const toman = await assertPurchasePrice(input)
  const amount = BigInt(toman)

  const order = await createPremiumOrderForUser(user, {
    paymentMethod: 'tron',
    amountToman: toman,
    months: input.months,
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

export { PremiumPurchaseError } from './premium-purchase.fulfillment.js'
