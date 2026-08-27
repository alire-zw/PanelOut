export type AutoReactionItem = {
  serviceId: number
  emoji: string
  quantity: number
  rate: number
}

export function parseAutoReactionItems(value: unknown): AutoReactionItem[] {
  if (!Array.isArray(value)) return []

  const items: AutoReactionItem[] = []

  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const serviceId = Number(record.serviceId)
    const quantity = Number(record.quantity)
    const rate = Number(record.rate)
    const emoji = typeof record.emoji === 'string' ? record.emoji : ''

    if (
      !Number.isFinite(serviceId) ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(rate) ||
      quantity <= 0 ||
      !emoji
    ) {
      continue
    }

    items.push({ serviceId, emoji, quantity, rate })
  }

  return items
}

export function serializeAutoReactionChannel(channel: {
  id: number
  chatId: bigint
  username: string
  title: string
  photoUrl: string | null
  isActive: boolean
  randomizeQuantity: boolean
  reactionsJson: unknown
  createdAt: Date
  updatedAt: Date
}) {
  const reactions = parseAutoReactionItems(channel.reactionsJson)

  return {
    id: channel.id,
    chatId: channel.chatId.toString(),
    username: channel.username,
    title: channel.title,
    photoUrl: channel.photoUrl,
    isActive: channel.isActive && reactions.length > 0,
    randomizeQuantity: channel.randomizeQuantity,
    reactions,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  }
}
