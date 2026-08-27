import {
  isValidJalaliDate,
  jalaliToGregorian,
  parseJalaliBirthInput,
} from './jalali.js'

export function isValidIranNationalId(code: string): boolean {
  if (!/^\d{10}$/.test(code)) return false
  if (/^(\d)\1{9}$/.test(code)) return false

  const check = Number(code[9])
  const sum = code
    .slice(0, 9)
    .split('')
    .reduce((acc, digit, index) => acc + Number(digit) * (10 - index), 0)
  const remainder = sum % 11
  return (remainder < 2 && check === remainder) || (remainder >= 2 && check === 11 - remainder)
}

export function jalaliBirthToUtcDate(value: string): Date | null {
  const parsed = parseJalaliBirthInput(value)
  if (!parsed) return null
  const { gy, gm, gd } = jalaliToGregorian(parsed.jy, parsed.jm, parsed.jd)
  return new Date(Date.UTC(gy, gm - 1, gd))
}

export {
  isValidJalaliDate,
  jalaliToGregorian,
  parseJalaliBirthInput,
  gregorianUtcToJalaliBirth,
} from './jalali.js'
