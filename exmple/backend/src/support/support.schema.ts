import { z } from 'zod'

export const SUPPORT_CATEGORIES = ['sales', 'product', 'kyc', 'wallet', 'other'] as const

export const supportCategorySchema = z.enum(SUPPORT_CATEGORIES)

/** data:image/...;base64,... — keep under ~700KB payload */
const imageDataSchema = z
  .string()
  .max(900_000)
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/)

export const createUserTicketSchema = z
  .object({
    category: supportCategorySchema,
    body: z.string().trim().max(4000).optional().default(''),
    orderId: z.string().trim().min(1).max(64).optional(),
    imageData: imageDataSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.body && !value.imageData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'متن یا تصویر الزامی است',
        path: ['body'],
      })
    }
  })

export const replyUserTicketSchema = z
  .object({
    body: z.string().trim().max(4000).optional().default(''),
    imageData: imageDataSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.body && !value.imageData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'متن یا تصویر الزامی است',
        path: ['body'],
      })
    }
  })

export type CreateUserTicketInput = z.infer<typeof createUserTicketSchema>
export type ReplyUserTicketInput = z.infer<typeof replyUserTicketSchema>

export const SUPPORT_CATEGORY_LABELS: Record<(typeof SUPPORT_CATEGORIES)[number], string> = {
  sales: 'واحد فروش',
  product: 'پشتیبانی محصول',
  kyc: 'احراز هویت',
  wallet: 'کیف پول و پرداخت',
  other: 'سایر',
}
