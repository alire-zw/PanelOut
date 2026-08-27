import { z } from 'zod'

export const listAdminAccountOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(['registered', 'processing', 'delivered']).default('registered'),
  search: z.string().trim().max(120).optional(),
})

export const updateAdminAccountOrderStatusBodySchema = z
  .object({
    status: z.enum(['registered', 'processing', 'delivered']),
    deliveryNote: z.string().trim().max(4000).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.status === 'delivered' && !body.deliveryNote?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryNote'],
        message: 'متن تحویل سفارش الزامی است',
      })
    }
  })

export type ListAdminAccountOrdersQuery = z.infer<typeof listAdminAccountOrdersQuerySchema>
export type UpdateAdminAccountOrderStatusBody = z.infer<
  typeof updateAdminAccountOrderStatusBodySchema
>
