import {
  isValidJalaaliDate,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from 'jalaali-js'

export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (jy < 1300 || jy > 1410) return false
  return isValidJalaaliDate(jy, jm, jd)
}

export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } {
  return toGregorian(jy, jm, jd)
}

export function parseJalaliBirthInput(value: string): {
  jy: number
  jm: number
  jd: number
} | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value.trim())
  if (!match) return null
  const jy = Number(match[1])
  const jm = Number(match[2])
  const jd = Number(match[3])
  if (!isValidJalaliDate(jy, jm, jd)) return null
  if (jd > jalaaliMonthLength(jy, jm)) return null
  return { jy, jm, jd }
}

/** Format stored Gregorian UTC date as Jalali YYYY/MM/DD for Zibal facility APIs. */
export function gregorianUtcToJalaliBirth(date: Date): string {
  const j = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`
}
