import type { DbUser } from '../db/types.js'
import { prisma } from '../db/client.js'
import { createShopGatewayPaymentWithWallet } from '../payments/mixed-gateway-payment.js'
import { invalidateWalletTransactionsCache } from '../wallet/wallet-transaction.service.js'
import { createAccountShopOrderForUser } from '../orders/order.service.js'
import {
  formatWarrantyLabel,
  normalizeCustomFields,
  type AccountShopPricingMode,
  type AccountShopWarrantyType,
} from '../admin/admin-account-plans.types.js'
import {
  convertUsdtToToman,
  getUsdtIrtPrice,
} from '../crypto-payments/swapwallet.client.js'
import { roundDisplayTomanUp } from '../pricing/product-pricing.apply.js'
import { getRoboticvnProduct } from '../roboticvn/roboticvn.client.js'
import {
  AccountShopPurchaseError,
  fulfillAccountShopOrder,
} from './account-shop-purchase.fulfillment.js'
import type { AccountShopPurchaseBody } from './account-shop-purchase.schema.js'
import { isAccountShopCategoryId } from './account-shop.catalog.js'

function asWarrantyType(value: string): AccountShopWarrantyType {
  if (value === 'full' || value === 'days' || value === 'none') return value
  return 'none'
}

function asPricingMode(value: string): AccountShopPricingMode {
  return value === 'variable' ? 'variable' : 'fixed'
}

async function assertAccountShopPurchase(input: AccountShopPurchaseBody) {
  if (!isAccountShopCategoryId(input.categoryId)) {
    throw new AccountShopPurchaseError('دسته نامعتبر است', 'PLAN_NOT_FOUND')
  }

  const plan = await prisma.accountShopPlan.findFirst({
    where: {
      id: input.planId,
      categoryId: input.categoryId,
      isActive: true,
    },
  })

  if (!plan) {
    throw new AccountShopPurchaseError('پلن یافت نشد', 'PLAN_NOT_FOUND')
  }

  const customFields = normalizeCustomFields(plan.customFields)
  const fieldValues: Record<string, string> = {}
  for (const field of customFields) {
    const raw = input.fieldValues?.[field.id]
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (field.required && !value) {
      throw new AccountShopPurchaseError(`فیلد «${field.label}» الزامی است`, 'INVALID_FIELDS')
    }
    if (value) fieldValues[field.id] = value
  }

  const warrantyType = asWarrantyType(plan.warrantyType)
  const pricingMode = asPricingMode(plan.pricingMode)
  const warrantyLabel = formatWarrantyLabel(warrantyType, plan.warrantyDays)

  let toman = 0
  let inStock = false

  try {
    const detail = await getRoboticvnProduct(plan.roboticvnProductId)
    const variant = detail.variants.find((item) => item.id === plan.roboticvnVariantId) ?? null
    inStock = Boolean(variant?.in_stock && (variant.available_quantity ?? 0) > 0)
    const priceUsd =
      typeof variant?.prices?.usd === 'number' && Number.isFinite(variant.prices.usd)
        ? variant.prices.usd
        : null

    if (pricingMode === 'fixed') {
      toman = roundDisplayTomanUp(plan.fixedToman ?? 0)
    } else if (priceUsd != null) {
      const usdtIrtPrice = await getUsdtIrtPrice()
      const base = convertUsdtToToman(priceUsd, usdtIrtPrice)
      toman = roundDisplayTomanUp(base * (1 + plan.markupPercent / 100))
    }
  } catch {
    if (pricingMode === 'fixed') {
      toman = roundDisplayTomanUp(plan.fixedToman ?? 0)
      inStock = true
    } else {
      throw new AccountShopPurchaseError('پلن در حال حاضر در دسترس نیست', 'PLAN_UNAVAILABLE')
    }
  }

  if (!inStock) {
    throw new AccountShopPurchaseError('این پلن ناموجود است', 'OUT_OF_STOCK')
  }

  if (toman <= 0 || toman !== input.toman) {
    throw new AccountShopPurchaseError(
      'قیمت تغییر کرده است. لطفاً دوباره تلاش کنید.',
      'PRICE_CHANGED',
    )
  }

  return {
    plan,
    toman,
    customFields,
    fieldValues,
    warrantyLabel,
  }
}

export async function purchaseAccountShopWithWallet(
  user: DbUser,
  input: AccountShopPurchaseBody,
) {
  const { plan, toman, customFields, fieldValues, warrantyLabel } =
    await assertAccountShopPurchase(input)
  const amount = BigInt(toman)

  const order = await createAccountShopOrderForUser(user, {
    paymentMethod: 'wallet',
    amountToman: toman,
    walletAmountToman: toman,
    planId: plan.id,
    accountCategoryId: plan.categoryId,
    planName: plan.name,
    durationLabel: plan.durationLabel,
    warrantyLabel,
    fieldValues,
    customFields,
  })

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } })
    if (!current || current.balance < amount) {
      throw new AccountShopPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    }

    await tx.user.update({
      where: { id: user.id },
      data: { balance: { decrement: amount } },
    })
  })

  try {
    await fulfillAccountShopOrder(order.orderId)
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
  }
}

export async function createAccountShopGatewayPayment(
  user: DbUser,
  input: AccountShopPurchaseBody,
) {
  const { plan, toman, customFields, fieldValues, warrantyLabel } =
    await assertAccountShopPurchase(input)

  const result = await createShopGatewayPaymentWithWallet({
    user,
    toman,
    useWalletBalance: input.useWalletBalance,
    description: `خرید اکانت ${plan.name}`,
    createOrder: (walletAmountToman) =>
      createAccountShopOrderForUser(user, {
        paymentMethod: 'zibal',
        amountToman: toman,
        walletAmountToman,
        planId: plan.id,
        accountCategoryId: plan.categoryId,
        planName: plan.name,
        durationLabel: plan.durationLabel,
        warrantyLabel,
        fieldValues,
        customFields,
      }),
    purchaseFullyWithWallet: () =>
      purchaseAccountShopWithWallet(user, { ...input, useWalletBalance: undefined }),
    throwInsufficientBalance: () => {
      throw new AccountShopPurchaseError('موجودی کیف پول کافی نیست', 'INSUFFICIENT_BALANCE')
    },
  })

  return result
}

export { AccountShopPurchaseError } from './account-shop-purchase.fulfillment.js'
