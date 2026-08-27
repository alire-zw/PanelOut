import { z } from 'zod'

export const starsPriceBodySchema = z.object({
  quantity: z.coerce.number().int().min(50).max(1_000_000),
})

export const starsRecipientBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(64)
    .transform((value) => value.replace(/^@+/, '')),
})

export const starsBuyBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.replace(/^@+/, '')),
  quantity: z.coerce.number().int().min(50).max(1_000_000),
  currency: z.enum(['GRAM', 'TON', 'USDT']).optional(),
})

export const starsGiveawayBuyBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.replace(/^@+/, '')),
  quantity: z.coerce.number().int().min(1).max(10_000),
  stars: z.coerce.number().int().min(500).max(1_000_000),
})
