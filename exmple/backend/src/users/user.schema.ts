import { z } from 'zod'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value ?? null)

export const userRoleSchema = z.enum(['user', 'admin', 'supervisor'])

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(128).optional(),
  role: userRoleSchema.optional(),
  isBanned: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  hasKyc: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
})

export const createUserSchema = z.object({
  telegramId: z.coerce.bigint().positive(),
  username: optionalText(64),
  firstName: optionalText(128),
  lastName: optionalText(128),
  realName: optionalText(128),
  phoneNumber: optionalText(20),
  email: z.string().trim().email().max(255).optional().nullable(),
  balance: z.coerce.bigint().min(0n).default(0n),
  role: userRoleSchema.default('user'),
  isPremium: z.boolean().default(false),
  isBanned: z.boolean().default(false),
  isActive: z.boolean().default(true),
  languageCode: optionalText(16),
})

export const updateMeSchema = z
  .object({
    realName: optionalText(128),
    email: z.string().trim().email().max(255).optional().nullable(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  })

export const updateUserSchema = z
  .object({
    username: optionalText(64),
    firstName: optionalText(128),
    lastName: optionalText(128),
    realName: optionalText(128),
    phoneNumber: optionalText(20),
    email: z.string().trim().email().max(255).optional().nullable(),
    balance: z.coerce.bigint().min(0n).optional(),
    role: userRoleSchema.optional(),
    isPremium: z.boolean().optional(),
    isBanned: z.boolean().optional(),
    isActive: z.boolean().optional(),
    languageCode: optionalText(16),
    /** Admin manual KYC: true = mark verified, false = clear verification */
    kycVerified: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  })

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateMeInput = z.infer<typeof updateMeSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
