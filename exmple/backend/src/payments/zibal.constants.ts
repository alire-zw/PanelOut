export const ZIBAL_SUCCESS_CODE = 100

export const ZIBAL_REQUEST_MESSAGES: Record<number, string> = {
  100: 'درخواست پرداخت با موفقیت ثبت شد',
  102: 'merchant یافت نشد',
  103: 'merchant غیرفعال است',
  104: 'merchant نامعتبر است',
  105: 'مبلغ باید بیشتر از ۱۰۰۰ ریال باشد',
  106: 'callbackUrl نامعتبر است',
  113: 'مبلغ از سقف تراکنش بیشتر است',
  201: 'قبلاً تایید شده است',
}

export const ZIBAL_VERIFY_MESSAGES: Record<number, string> = {
  100: 'پرداخت با موفقیت تایید شد',
  102: 'merchant یافت نشد',
  103: 'merchant غیرفعال است',
  104: 'merchant نامعتبر است',
  201: 'قبلاً تایید شده است',
  202: 'سفارش پرداخت نشده یا ناموفق بوده است',
  203: 'trackId نامعتبر است',
}

export function getZibalRequestMessage(code: number): string {
  return ZIBAL_REQUEST_MESSAGES[code] ?? 'خطا در ایجاد درخواست پرداخت'
}

export function getZibalVerifyMessage(code: number): string {
  return ZIBAL_VERIFY_MESSAGES[code] ?? 'خطا در تایید پرداخت'
}

export const TOMAN_TO_RIAL = 10n
export const MIN_PAYMENT_TOMAN = 1000n
export const MIN_PAYMENT_RIAL = MIN_PAYMENT_TOMAN * TOMAN_TO_RIAL
