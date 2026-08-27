const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export const MIN_CHARGE_TOMAN = 10_000
export const MAX_CHARGE_TOMAN = 50_000_000
export const MIN_TRANSFER_TOMAN = 1_000
export const MAX_AMOUNT_DIGITS = 9

export function toPersianDigit(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)] ?? digit)
}

export function parseAmountDigits(digits: string): number {
  const normalized = digits.replace(/\D/g, '')
  if (!normalized) return 0
  return Number(normalized)
}

export function formatAmountFa(digits: string): string {
  const amount = parseAmountDigits(digits)
  if (!digits) return toPersianDigit('0')
  return toPersianDigit(amount.toLocaleString('en-US'))
}

export function appendAmountDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit)) return current
  if (current === '0') {
    return digit === '0' ? current : digit
  }
  if (current.length >= MAX_AMOUNT_DIGITS) return current
  return `${current}${digit}`
}

export function removeLastAmountDigit(current: string): string {
  return current.slice(0, -1)
}

export function isChargeAmountValid(amountToman: number): boolean {
  return (
    Number.isFinite(amountToman) &&
    amountToman >= MIN_CHARGE_TOMAN &&
    amountToman <= MAX_CHARGE_TOMAN
  )
}

export function getChargeAmountError(amountToman: number, hasInput: boolean): string | null {
  if (!hasInput || amountToman <= 0) return null
  if (amountToman < MIN_CHARGE_TOMAN) {
    return `حداقل مبلغ شارژ ${MIN_CHARGE_TOMAN.toLocaleString('fa-IR')} تومان است`
  }
  if (amountToman > MAX_CHARGE_TOMAN) {
    return `حداکثر مبلغ شارژ ${MAX_CHARGE_TOMAN.toLocaleString('fa-IR')} تومان است`
  }
  return null
}

export function isTransferAmountValid(amountToman: number, balanceToman: number): boolean {
  return (
    Number.isFinite(amountToman) &&
    amountToman >= MIN_TRANSFER_TOMAN &&
    amountToman <= balanceToman
  )
}

export function getTransferAmountError(
  amountToman: number,
  hasInput: boolean,
  balanceToman: number,
): string | null {
  if (!hasInput || amountToman <= 0) return null
  if (amountToman < MIN_TRANSFER_TOMAN) {
    return `حداقل مبلغ انتقال ${MIN_TRANSFER_TOMAN.toLocaleString('fa-IR')} تومان است`
  }
  if (amountToman > balanceToman) {
    return 'موجودی کیف پول کافی نیست'
  }
  return null
}
