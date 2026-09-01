const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const TB_IN_GB = 1024

export function parseTrafficGb(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value
  if (value == null || value === '') return Number.NaN

  let text = String(value).trim()
  text = text.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
  text = text.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
  text = text.replace(/[٬,]/g, '')
  return Number(text)
}

function formatFaAmount(value: number, fractionDigits: number) {
  return value.toLocaleString('fa-IR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatFaTraffic(
  value: string | number | null | undefined,
  mode: 'short' | 'long' = 'short',
): string {
  const gb = parseTrafficGb(value)
  if (!Number.isFinite(gb)) return '۰'

  if (gb >= TB_IN_GB) {
    const tb = gb / TB_IN_GB
    const amount = formatFaAmount(tb, tb >= 10 ? 1 : 2)
    return `${amount} ترابایت`
  }

  const amount = formatFaAmount(gb, mode === 'long' ? 2 : 1)
  return mode === 'long' ? `${amount} گیگابایت` : `${amount} گیگ`
}

export function formatFaTrafficFromBytes(
  bytes: string | number | bigint | null | undefined,
): { amount: string; unit: string } {
  let value = 0n
  try {
    value = BigInt(bytes ?? 0)
  } catch {
    return formatFaTrafficParts(0)
  }

  if (value <= 0n) return formatFaTrafficParts(0)

  const gbTimes100 = (value * 100n + 1024n ** 3n - 1n) / 1024n ** 3n
  return formatFaTrafficParts(Number(gbTimes100) / 100)
}

export function formatFaTrafficParts(
  value: string | number | null | undefined,
): { amount: string; unit: string } {
  const gb = parseTrafficGb(value)
  if (!Number.isFinite(gb) || gb <= 0) {
    return { amount: '۰', unit: 'گیگ' }
  }

  if (gb >= TB_IN_GB) {
    const tb = gb / TB_IN_GB
    return {
      amount: formatFaAmount(tb, tb >= 10 ? 1 : 2),
      unit: 'ترابایت',
    }
  }

  const fractionDigits = gb >= 100 ? 0 : gb >= 10 ? 1 : 2
  return {
    amount: formatFaAmount(gb, fractionDigits),
    unit: 'گیگ',
  }
}
