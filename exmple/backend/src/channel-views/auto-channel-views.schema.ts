import { z } from 'zod'
import { CHANNEL_VIEW_SERVICE_ID } from './channel-views.pricing.js'

export const autoChannelViewsRegisterBodySchema = z.object({
  link: z.string().trim().min(1).max(512),
})

export const autoChannelViewsConfigureBodySchema = z.object({
  serviceId: z.literal(CHANNEL_VIEW_SERVICE_ID),
  quantity: z.number().int().positive(),
  rate: z.number().positive(),
  randomizeQuantity: z.boolean().optional().default(false),
})

export type AutoChannelViewsRegisterBody = z.infer<typeof autoChannelViewsRegisterBodySchema>
export type AutoChannelViewsConfigureBody = z.infer<typeof autoChannelViewsConfigureBodySchema>
