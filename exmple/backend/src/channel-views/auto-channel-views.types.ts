export type AutoChannelViewChannelDto = {
  id: number
  chatId: string
  username: string
  title: string
  photoUrl: string | null
  isActive: boolean
  randomizeQuantity: boolean
  serviceId: number
  quantity: number
  rate: number
  createdAt: string
  updatedAt: string
}

export function serializeAutoChannelViewChannel(channel: {
  id: number
  chatId: bigint
  username: string
  title: string
  photoUrl: string | null
  isActive: boolean
  randomizeQuantity: boolean
  serviceId: number
  quantity: number
  rate: number
  createdAt: Date
  updatedAt: Date
}): AutoChannelViewChannelDto {
  const hasConfig = channel.quantity > 0 && channel.rate > 0

  return {
    id: channel.id,
    chatId: channel.chatId.toString(),
    username: channel.username,
    title: channel.title,
    photoUrl: channel.photoUrl,
    isActive: channel.isActive && hasConfig,
    randomizeQuantity: channel.randomizeQuantity,
    serviceId: channel.serviceId,
    quantity: channel.quantity,
    rate: channel.rate,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  }
}
