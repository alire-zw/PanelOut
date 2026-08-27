import { z } from 'zod'

export const starsPurchaseBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.replace(/^@+/, '')),
  quantity: z.coerce.number().int().min(50).max(1_000_000),
  toman: z.coerce.number().int().positive(),
  recipientName: z.string().trim().max(128).optional(),
  recipientPhoto: z.string().trim().max(2048).optional(),
  useWalletBalance: z.boolean().optional(),
})

export type StarsPurchaseBody = z.infer<typeof starsPurchaseBodySchema>
