import { z } from 'zod'

export const reactionPostPreviewBodySchema = z.object({
  link: z.string().trim().min(1).max(512),
})

const reactionPurchaseItemSchema = z.object({
  serviceId: z.number().int().positive(),
  emoji: z.string().trim().min(1).max(32),
  quantity: z.number().int().positive(),
  rate: z.number().positive(),
})

export const reactionPurchaseBodySchema = z.object({
  post: z.object({
    username: z.string().trim().min(1).max(64),
    messageId: z.number().int().positive(),
    link: z.string().trim().min(1).max(512),
    title: z.string().trim().min(1).max(128),
    preview: z.string().trim().max(255).optional().default(''),
    photo: z.string().trim().max(2048).optional().default(''),
  }),
  reactions: z.array(reactionPurchaseItemSchema).min(1).max(80),
  toman: z.number().int().positive(),
  useWalletBalance: z.boolean().optional(),
})

export const autoReactionRegisterBodySchema = z.object({
  link: z.string().trim().min(1).max(512),
})

export const autoReactionConfigureBodySchema = z.object({
  reactions: z.array(reactionPurchaseItemSchema).min(1).max(80),
  randomizeQuantity: z.boolean().optional().default(false),
})

export type ReactionPurchaseBody = z.infer<typeof reactionPurchaseBodySchema>
export type ReactionPurchaseItem = z.infer<typeof reactionPurchaseItemSchema>
export type AutoReactionRegisterBody = z.infer<typeof autoReactionRegisterBodySchema>
export type AutoReactionConfigureBody = z.infer<typeof autoReactionConfigureBodySchema>
