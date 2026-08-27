import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { createShopGatewayPaymentWithWallet } from '../payments/mixed-gateway-payment.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import {
  createVirtualNumberOrderForUser,
} from '../orders/order.service.js'
import { findLiveVirtualNumberCountry } from './virtual-number-countries.service.js'
import {
  fulfillVirtualNumberOrder,
  VirtualNumberPurchaseError,
} from './virtual-number-purchase.fulfillment.js'
import type { VirtualNumberPurchaseBody } from './virtual-number.schema.js'

async function assertPurchasePrice(input: VirtualNumberPurchaseBody): Promise<number> {
  const country = await findLiveVirtualNumberCountry(input.countryId, input.noneReport)

  if (!country) {
    throw new VirtualNumberPurchaseError('کشور انتخاب‌شده موجود نیست', 'COUNTRY_UNAVAILABLE')
  }

  if (!country.available) {
    throw new VirtualNumberPurchaseError(
      'در حال حاضر این کشور ناموجود است. لطفاً کشور دیگری انتخاب کنید.',
      'COUNTRY_UNAVAILABLE',
    )
  }

  if (country.toman !== input.toman) {
    throw new VirtualNumberPurchaseError('قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.', 'PRICE_CHANGED')
  }

  return country.toman
}

export async function purchaseVirtualNumberWithWallet(
  user: DbUser,
  input: VirtualNumberPurchaseBody,
) {
  const toman = await assertPurchasePrice(input)
  const amount = BigInt(toman)

  const order = await createVirtualNumberOrderForUser(user, {
    paymentMethod: 'wallet',
    amountToman: toman,
    walletAmountToman: toman,
    countryId: input.countryId,
    country: input.country,
    flagCode: input.flagCode,
    quality: input.quality,
  })

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (!current || current.balance < amount) {
      throw new VirtualNumberPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: amount },
      },
    })
  })

  try {
    await fulfillVirtualNumberOrder(order.orderId)
  } catch (error) {
    await prisma.user.update({
      where: { id: user.id },
      data: { balance: { increment: amount } },
    })
    throw error
  }

  void invalidateWalletTransactionsCache(user.id)

  const fulfilled = await prisma.order.findUnique({
    where: { orderId: order.orderId },
    include: { virtualNumber: true },
  })

  return {
    orderId: order.orderId,
    toman,
    number: fulfilled?.virtualNumber?.number ?? null,
    country: fulfilled?.virtualNumber?.country ?? input.country,
    quality: fulfilled?.virtualNumber?.quality ?? input.quality,
  }
}

export async function createVirtualNumberGatewayPayment(
  user: DbUser,
  input: VirtualNumberPurchaseBody,
) {
  const toman = await assertPurchasePrice(input)

  return createShopGatewayPaymentWithWallet({
    user,
    toman,
    useWalletBalance: input.useWalletBalance,
    description: `خرید شماره مجازی ${input.country}`,
    createOrder: (walletAmountToman) =>
      createVirtualNumberOrderForUser(user, {
        paymentMethod: 'zibal',
        amountToman: toman,
        walletAmountToman,
        countryId: input.countryId,
        country: input.country,
        flagCode: input.flagCode,
        quality: input.quality,
      }),
    purchaseFullyWithWallet: () =>
      purchaseVirtualNumberWithWallet(user, { ...input, useWalletBalance: undefined }),
    throwInsufficientBalance: () => {
      throw new VirtualNumberPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    },
  })
}

export { VirtualNumberPurchaseError } from './virtual-number-purchase.fulfillment.js'
