const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const MIN_RIAL_DEPOSIT_TOMAN = 50_000n;

export function parseTomanAmount(text) {
  let normalized = String(text).trim();

  for (let i = 0; i < 10; i += 1) {
    normalized = normalized.replaceAll(PERSIAN_DIGITS[i], String(i));
    normalized = normalized.replaceAll(ARABIC_DIGITS[i], String(i));
  }

  normalized = normalized.replace(/[,،\s]/g, "");

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const amount = BigInt(normalized);

  if (amount <= 0n || amount > 999_999_999_999n) {
    return null;
  }

  return amount;
}
