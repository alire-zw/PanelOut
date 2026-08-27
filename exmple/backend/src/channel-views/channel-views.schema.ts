import { z } from 'zod'
import { CHANNEL_VIEW_SERVICE_ID } from './channel-views.pricing.js'

export const channelViewsPurchaseBodySchema = z.object({
  post: z.object({
    username: z.string().trim().min(1).max(64),
    messageId: z.number().int().positive(),
    link: z.string().trim().min(1).max(512),
    title: z.string().trim().min(1).max(128),
    preview: z.string().trim().max(255).optional().default(''),
    photo: z.string().trim().max(2048).optional().default(''),
  }),
  serviceId: z.literal(CHANNEL_VIEW_SERVICE_ID),
  quantity: z.number().int().positive(),
  rate: z.number().positive(),
  toman: z.number().int().positive(),
  useWalletBalance: z.boolean().optional(),
})

export type ChannelViewsPurchaseBody = z.infer<typeof channelViewsPurchaseBodySchema>
