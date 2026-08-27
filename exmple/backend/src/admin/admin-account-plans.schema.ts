import { z } from 'zod'
import { isAccountShopCategoryId } from '../chatgpt/account-shop.catalog.js'

const categoryIdSchema = z
  .string()
  .trim()
  .refine((value) => isAccountShopCategoryId(value), 'Invalid account category')

const customFieldSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(96),
  placeholder: z.string().trim().max(160).default(''),
  required: z.boolean().default(true),
})

export const accountShopCustomFieldsSchema = z.array(customFieldSchema).max(12)

export const warrantyTypeSchema = z.enum(['none', 'days', 'full'])
export const pricingModeSchema = z.enum(['fixed', 'variable'])
export const noticeKindSchema = z.enum(['none', 'info', 'warning', 'note'])

export const createAccountShopPlanSchema = z
  .object({
    categoryId: categoryIdSchema,
    name: z.string().trim().min(1).max(160),
    durationLabel: z.string().trim().min(1).max(96),
    warrantyType: warrantyTypeSchema,
    warrantyDays: z.number().int().min(0).max(3650).nullable().optional(),
    roboticvnProductId: z.string().trim().min(1).max(64),
    roboticvnVariantId: z.string().trim().min(1).max(64),
    roboticvnVariantTitle: z.string().trim().min(1).max(255),
    pricingMode: pricingModeSchema,
    fixedToman: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    markupPercent: z.number().int().min(-90).max(500).default(0),
    customFields: accountShopCustomFieldsSchema.default([]),
    noticeKind: noticeKindSchema.default('none'),
    noticeText: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.warrantyType === 'days') {
      if (value.warrantyDays == null || !Number.isFinite(value.warrantyDays)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['warrantyDays'],
          message: 'تعداد روز گارانتی را وارد کنید',
        })
      }
    }
    if (value.pricingMode === 'fixed') {
      if (value.fixedToman == null || value.fixedToman <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedToman'],
          message: 'قیمت ثابت تومان الزامی است',
        })
      }
    }
    if (value.noticeKind !== 'none') {
      if (!value.noticeText?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['noticeText'],
          message: 'متن نکته / هشدار / اطلاعات را وارد کنید',
        })
      }
    }
  })

export type CreateAccountShopPlanInput = z.infer<typeof createAccountShopPlanSchema>

export const updateAccountShopPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    durationLabel: z.string().trim().min(1).max(96).optional(),
    warrantyType: warrantyTypeSchema.optional(),
    warrantyDays: z.number().int().min(0).max(3650).nullable().optional(),
    roboticvnProductId: z.string().trim().min(1).max(64).optional(),
    roboticvnVariantId: z.string().trim().min(1).max(64).optional(),
    roboticvnVariantTitle: z.string().trim().min(1).max(255).optional(),
    pricingMode: pricingModeSchema.optional(),
    fixedToman: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    markupPercent: z.number().int().min(-90).max(500).optional(),
    customFields: accountShopCustomFieldsSchema.optional(),
    noticeKind: noticeKindSchema.optional(),
    noticeText: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.warrantyType === 'days' && value.warrantyDays == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['warrantyDays'],
        message: 'تعداد روز گارانتی را وارد کنید',
      })
    }
    if (value.pricingMode === 'fixed' && (value.fixedToman == null || value.fixedToman <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixedToman'],
        message: 'قیمت ثابت تومان الزامی است',
      })
    }
    if (value.noticeKind != null && value.noticeKind !== 'none') {
      if (value.noticeText !== undefined && !value.noticeText?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['noticeText'],
          message: 'متن نکته / هشدار / اطلاعات را وارد کنید',
        })
      }
    }
  })

export type UpdateAccountShopPlanInput = z.infer<typeof updateAccountShopPlanSchema>

export const listAccountShopPlansQuerySchema = z.object({
  categoryId: categoryIdSchema.optional(),
})

export const roboticvnProductsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
