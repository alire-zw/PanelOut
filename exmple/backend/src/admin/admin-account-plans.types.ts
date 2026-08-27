export type AccountShopWarrantyType = 'none' | 'days' | 'full'
export type AccountShopPricingMode = 'fixed' | 'variable'
export type AccountShopNoticeKind = 'none' | 'info' | 'warning' | 'note'

export type AccountShopCustomField = {
  id: string
  label: string
  placeholder: string
  required: boolean
}

export function asNoticeKind(value: unknown): AccountShopNoticeKind {
  if (value === 'info' || value === 'warning' || value === 'note' || value === 'none') {
    return value
  }
  return 'none'
}

export function formatWarrantyLabel(
  warrantyType: AccountShopWarrantyType,
  warrantyDays: number | null | undefined,
): string {
  if (warrantyType === 'full') return 'گارانتی کامل'
  if (warrantyType === 'none') return 'بدون گارانتی'

  const days = warrantyDays ?? 0
  if (days <= 0) return 'بدون گارانتی'
  if (days === 7) return 'یک هفته گارانتی'
  if (days === 30) return 'یک ماه گارانتی'
  return `${days} روز گارانتی`
}

export function normalizeCustomFields(value: unknown): AccountShopCustomField[] {
  if (!Array.isArray(value)) return []
  const fields: AccountShopCustomField[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    if (!id || !label) continue
    fields.push({
      id,
      label,
      placeholder: typeof row.placeholder === 'string' ? row.placeholder.trim() : '',
      required: row.required !== false,
    })
  }
  return fields
}
