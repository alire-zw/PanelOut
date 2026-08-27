import { z } from 'zod'
import { TELEGRAM_MEMBER_SERVICE_IDS } from './telegram-members.pricing.js'

export const telegramMembersPurchaseBodySchema = z.object({
  channel: z.object({
    username: z.string().trim().min(1).max(64),
    link: z.string().trim().min(1).max(512),
    title: z.string().trim().min(1).max(128),
    photo: z.string().trim().max(2048).optional().default(''),
    subscribers: z.string().trim().max(64).optional().default(''),
  }),
  serviceId: z.number().int().refine(
    (value) => (TELEGRAM_MEMBER_SERVICE_IDS as readonly number[]).includes(value),
    { message: 'سرویس ممبر نامعتبر است' },
  ),
  quantity: z.number().int().positive(),
  rate: z.number().positive(),
  toman: z.number().int().positive(),
  useWalletBalance: z.boolean().optional(),
})

export type TelegramMembersPurchaseBody = z.infer<typeof telegramMembersPurchaseBodySchema>
