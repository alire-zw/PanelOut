import { z } from 'zod'

export const executeTransferSchema = z.object({
  recipientTelegramId: z.coerce.number().int().positive(),
  amount: z.coerce.bigint().positive(),
})

export type ExecuteTransferInput = z.infer<typeof executeTransferSchema>
