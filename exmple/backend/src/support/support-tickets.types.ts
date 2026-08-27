export type SupportTicketListItem = {
  id: number
  ticketCode: string
  category: string
  categoryLabel: string
  orderId: string | null
  subject: string
  status: string
  createdAt: string
  updatedAt: string
  lastMessage: { senderRole: string; body: string; createdAt: string } | null
}

export type CachedSupportTickets = {
  version: string
  cachedAt: string
  items: SupportTicketListItem[]
}

export type SupportTicketsSyncResult = CachedSupportTickets & {
  changed: boolean
}

export type CachedSupportTicketDetail = {
  version: string
  cachedAt: string
  // Serialized ticket detail (messages may include imageData)
  ticket: object
}
