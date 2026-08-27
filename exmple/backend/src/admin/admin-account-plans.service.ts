import { prisma } from '../db/client.js'
import type { AccountShopCategoryId } from '../chatgpt/account-shop.catalog.js'
import {
  getRoboticvnProduct,
  listRoboticvnProducts,
} from '../roboticvn/roboticvn.client.js'
import type {
  CreateAccountShopPlanInput,
  UpdateAccountShopPlanInput,
} from './admin-account-plans.schema.js'
import {
  asNoticeKind,
  formatWarrantyLabel,
  normalizeCustomFields,
  type AccountShopCustomField,
  type AccountShopNoticeKind,
  type AccountShopPricingMode,
  type AccountShopWarrantyType,
} from './admin-account-plans.types.js'

export type AccountShopPlanDto = {
  id: number
  categoryId: AccountShopCategoryId
  name: string
  durationLabel: string
  warrantyType: AccountShopWarrantyType
  warrantyDays: number | null
  warrantyLabel: string
  roboticvnProductId: string
  roboticvnVariantId: string
  roboticvnVariantTitle: string
  pricingMode: AccountShopPricingMode
  fixedToman: number | null
  markupPercent: number
  customFields: AccountShopCustomField[]
  noticeKind: AccountShopNoticeKind
  noticeText: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function asWarrantyType(value: string): AccountShopWarrantyType {
  if (value === 'full' || value === 'days' || value === 'none') return value
  return 'none'
}

function asPricingMode(value: string): AccountShopPricingMode {
  return value === 'variable' ? 'variable' : 'fixed'
}

function normalizeNotice(
  kindRaw: unknown,
  textRaw: unknown,
): { noticeKind: AccountShopNoticeKind; noticeText: string | null } {
  const noticeKind = asNoticeKind(kindRaw)
  const noticeText =
    typeof textRaw === 'string' && textRaw.trim() ? textRaw.trim() : null
  if (noticeKind === 'none') return { noticeKind: 'none', noticeText: null }
  return { noticeKind, noticeText }
}

function serializePlan(row: {
  id: number
  categoryId: string
  name: string
  durationLabel: string
  warrantyType: string
  warrantyDays: number | null
  roboticvnProductId: string
  roboticvnVariantId: string
  roboticvnVariantTitle: string
  pricingMode: string
  fixedToman: number | null
  markupPercent: number
  customFields: unknown
  noticeKind?: string | null
  noticeText?: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): AccountShopPlanDto {
  const warrantyType = asWarrantyType(row.warrantyType)
  const notice = normalizeNotice(row.noticeKind, row.noticeText)
  return {
    id: row.id,
    categoryId: row.categoryId as AccountShopCategoryId,
    name: row.name,
    durationLabel: row.durationLabel,
    warrantyType,
    warrantyDays: row.warrantyDays,
    warrantyLabel: formatWarrantyLabel(warrantyType, row.warrantyDays),
    roboticvnProductId: row.roboticvnProductId,
    roboticvnVariantId: row.roboticvnVariantId,
    roboticvnVariantTitle: row.roboticvnVariantTitle,
    pricingMode: asPricingMode(row.pricingMode),
    fixedToman: row.fixedToman,
    markupPercent: row.markupPercent,
    customFields: normalizeCustomFields(row.customFields),
    noticeKind: notice.noticeKind,
    noticeText: notice.noticeText,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listAccountShopPlansAdmin(categoryId?: AccountShopCategoryId) {
  const items = await prisma.accountShopPlan.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  })
  return { items: items.map(serializePlan) }
}

export async function getAccountShopPlanAdmin(id: number) {
  const row = await prisma.accountShopPlan.findUnique({ where: { id } })
  if (!row) return null
  return { plan: serializePlan(row) }
}

export async function createAccountShopPlan(input: CreateAccountShopPlanInput) {
  const warrantyType = input.warrantyType
  const warrantyDays =
    warrantyType === 'days' ? (input.warrantyDays ?? 0) : warrantyType === 'none' ? 0 : null
  const notice = normalizeNotice(input.noticeKind, input.noticeText)

  const created = await prisma.accountShopPlan.create({
    data: {
      categoryId: input.categoryId,
      name: input.name,
      durationLabel: input.durationLabel,
      warrantyType,
      warrantyDays,
      roboticvnProductId: input.roboticvnProductId,
      roboticvnVariantId: input.roboticvnVariantId,
      roboticvnVariantTitle: input.roboticvnVariantTitle,
      pricingMode: input.pricingMode,
      fixedToman: input.pricingMode === 'fixed' ? (input.fixedToman ?? 0) : null,
      markupPercent: input.pricingMode === 'variable' ? input.markupPercent : 0,
      customFields: input.customFields,
      noticeKind: notice.noticeKind,
      noticeText: notice.noticeText,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })

  return { plan: serializePlan(created) }
}

export async function updateAccountShopPlan(id: number, input: UpdateAccountShopPlanInput) {
  const existing = await prisma.accountShopPlan.findUnique({ where: { id } })
  if (!existing) return null

  const warrantyType = input.warrantyType
    ? asWarrantyType(input.warrantyType)
    : asWarrantyType(existing.warrantyType)
  let warrantyDays = existing.warrantyDays
  if (input.warrantyType != null || input.warrantyDays !== undefined) {
    if (warrantyType === 'days') {
      warrantyDays = input.warrantyDays ?? existing.warrantyDays ?? 0
    } else if (warrantyType === 'none') {
      warrantyDays = 0
    } else {
      warrantyDays = null
    }
  }

  const pricingMode = input.pricingMode
    ? asPricingMode(input.pricingMode)
    : asPricingMode(existing.pricingMode)

  const nextNoticeKind =
    input.noticeKind != null ? asNoticeKind(input.noticeKind) : asNoticeKind(existing.noticeKind)
  const nextNoticeText =
    input.noticeText !== undefined
      ? input.noticeText
      : existing.noticeText
  const notice = normalizeNotice(nextNoticeKind, nextNoticeText)

  const updated = await prisma.accountShopPlan.update({
    where: { id },
    data: {
      name: input.name,
      durationLabel: input.durationLabel,
      warrantyType: input.warrantyType ?? undefined,
      warrantyDays,
      roboticvnProductId: input.roboticvnProductId,
      roboticvnVariantId: input.roboticvnVariantId,
      roboticvnVariantTitle: input.roboticvnVariantTitle,
      pricingMode: input.pricingMode ?? undefined,
      fixedToman:
        input.pricingMode != null || input.fixedToman !== undefined
          ? pricingMode === 'fixed'
            ? (input.fixedToman ?? existing.fixedToman ?? 0)
            : null
          : undefined,
      markupPercent:
        input.pricingMode != null || input.markupPercent !== undefined
          ? pricingMode === 'variable'
            ? (input.markupPercent ?? existing.markupPercent)
            : 0
          : undefined,
      customFields: input.customFields,
      noticeKind:
        input.noticeKind != null || input.noticeText !== undefined ? notice.noticeKind : undefined,
      noticeText:
        input.noticeKind != null || input.noticeText !== undefined ? notice.noticeText : undefined,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  })

  return { plan: serializePlan(updated) }
}

export async function deleteAccountShopPlan(id: number) {
  const existing = await prisma.accountShopPlan.findUnique({ where: { id } })
  if (!existing) return null
  await prisma.accountShopPlan.delete({ where: { id } })
  return { ok: true as const }
}

export async function searchRoboticvnProductsForAdmin(input: {
  search?: string
  limit?: number
  offset?: number
}) {
  return listRoboticvnProducts(input)
}

export async function getRoboticvnProductForAdmin(productId: string) {
  return getRoboticvnProduct(productId)
}
