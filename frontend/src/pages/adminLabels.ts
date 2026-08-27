export function formatFaNumber(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '۰'
  return Math.floor(num).toLocaleString('fa-IR')
}

export function formatFaDateLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function orderStatusBadgeClass(status: string): string {
  if (status === 'completed') return 'admin__badge admin__badge--success'
  if (status === 'failed' || status === 'cancelled') {
    return 'admin__badge admin__badge--error'
  }
  if (status === 'pending' || status === 'processing') {
    return 'admin__badge admin__badge--warn'
  }
  return 'admin__badge'
}

export function displayUsername(user: {
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  realName?: string | null
  id?: number
  telegramId?: string | number
}): string {
  if (user.username) return `@${user.username}`
  if (user.realName) return user.realName
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  if (name) return name
  if (user.telegramId) return `کاربر ${formatFaNumber(user.telegramId)}`
  if (user.id) return `کاربر ${formatFaNumber(user.id)}`
  return 'کاربر'
}

export function ticketTitle(ticketCode: string, subject: string): string {
  return `تیکت ${ticketCode} · ${subject}`
}

export function ticketStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'باز'
    case 'answered':
      return 'پاسخ‌داده‌شده'
    case 'closed':
      return 'بسته‌شده'
    default:
      return status
  }
}
