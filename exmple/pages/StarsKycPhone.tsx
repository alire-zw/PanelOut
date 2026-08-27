import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { NumeralKeypad } from '../components/NumeralKeypad'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { hasVerifiedPhone } from '../lib/kyc'
import { sendKycPhoneOtp, verifyKycPhoneOtp } from '../lib/kycApi'
import {
  appendOtpDigit,
  appendPhoneDigit,
  formatCountdownFa,
  formatOtpDisplay,
  formatPhoneFa,
  getPhoneInputError,
  isValidIrMobile,
  OTP_CODE_LENGTH,
  removeLastOtpDigit,
  removeLastPhoneDigit,
} from '../lib/phone'
import type { KycResumeState } from '../types/kycFlow'
import {
  getKycConfirmPath,
  isValidKycResumeState,
  toKycConfirmState,
} from '../lib/kycFlow'
import { getKycThemeStyle } from '../lib/kycTheme'
import '../styles/shop-rise.css'
import './StarsKycPhone.css'

type PhoneStep = 'phone' | 'otp'

export function StarsKycPhonePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const { user, refetch } = useUser()
  const kycState = location.state as KycResumeState | null

  const [step, setStep] = useState<PhoneStep>(() =>
    kycState?.phoneDigits && isValidIrMobile(kycState.phoneDigits) && kycState.otpResendSeconds
      ? 'otp'
      : 'phone',
  )
  const [phoneDigits, setPhoneDigits] = useState(() => kycState?.phoneDigits ?? '')
  const [codeDigits, setCodeDigits] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(() => kycState?.otpResendSeconds ?? 0)
  const verifyingRef = useRef(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  useEffect(() => {
    if (!isValidKycResumeState(kycState)) {
      navigate('/', { replace: true })
      return
    }

    if (hasVerifiedPhone(user)) {
      navigate('/stars/kyc/identity', {
        replace: true,
        state: { ...kycState, phoneJustVerified: true },
      })
    }
  }, [kycState, navigate, user])

  const handleBack = useCallback(() => {
    if (!isValidKycResumeState(kycState)) {
      navigate('/', { replace: true })
      return
    }

    if (step === 'otp') {
      haptic('light')
      setStep('phone')
      setCodeDigits('')
      return
    }

    navigate(getKycConfirmPath(kycState.product, kycState), {
      replace: true,
      state: toKycConfirmState(kycState),
    })
  }, [haptic, kycState, navigate, step])

  useEffect(() => {
    if (!isTelegramWebApp()) return

    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return

    backButton.show()
    backButton.onClick(handleBack)

    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [handleBack])

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  const phoneError = useMemo(() => getPhoneInputError(phoneDigits), [phoneDigits])
  const canSend = isValidIrMobile(phoneDigits) && !isSending
  const canVerify = codeDigits.length === OTP_CODE_LENGTH && !isVerifying

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'error',
  ) => {
    setNotification({ show: true, message, type })
  }

  const handleSendOtp = async () => {
    if (!canSend || !isValidKycResumeState(kycState)) return

    haptic('light')
    setIsSending(true)

    try {
      const result = await sendKycPhoneOtp(phoneDigits)
      setResendSeconds(result.resendAvailableInSeconds)
      setCodeDigits('')
      setStep('otp')
      if (result.alreadySent) {
        showNotification('کد قبلاً برای شما ارسال شده است', 'info')
      }
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'ارسال کد ناموفق بود', 'error')
    } finally {
      setIsSending(false)
    }
  }

  const handleVerify = useCallback(
    async (code: string) => {
      if (!isValidKycResumeState(kycState) || verifyingRef.current) return
      if (!isValidIrMobile(phoneDigits) || code.length !== OTP_CODE_LENGTH) return

      verifyingRef.current = true
      setIsVerifying(true)
      haptic('light')

      try {
        await verifyKycPhoneOtp(phoneDigits, code)
        await refetch({ silent: true })

        navigate('/stars/kyc/identity', {
          replace: true,
          state: {
            ...kycState,
            phoneDigits,
            phoneJustVerified: true,
          },
        })
      } catch (error) {
        setCodeDigits('')
        showNotification(error instanceof Error ? error.message : 'تأیید کد ناموفق بود', 'error')
      } finally {
        verifyingRef.current = false
        setIsVerifying(false)
      }
    },
    [haptic, kycState, navigate, phoneDigits, refetch],
  )

  const handleResend = async () => {
    if (!isValidIrMobile(phoneDigits) || resendSeconds > 0 || isResending) return

    setIsResending(true)
    haptic('light')
    try {
      const result = await sendKycPhoneOtp(phoneDigits)
      setResendSeconds(result.resendAvailableInSeconds)
      setCodeDigits('')
      showNotification('کد جدید ارسال شد', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ارسال مجدد ناموفق بود'
      const retryAfter =
        error && typeof error === 'object' && 'retryAfterSeconds' in error
          ? Number((error as { retryAfterSeconds?: number }).retryAfterSeconds)
          : NaN
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setResendSeconds(retryAfter)
      }
      showNotification(message, 'error')
    } finally {
      setIsResending(false)
    }
  }

  const handleContinue = () => {
    if (step === 'phone') {
      void handleSendOtp()
      return
    }
    void handleVerify(codeDigits)
  }

  const handleDigit = (digit: string) => {
    if (isSending || isVerifying) return

    if (step === 'phone') {
      setPhoneDigits((current) => appendPhoneDigit(current, digit))
      return
    }

    setCodeDigits((current) => {
      const next = appendOtpDigit(current, digit)
      if (next.length === OTP_CODE_LENGTH) {
        void handleVerify(next)
      }
      return next
    })
  }

  const handleBackspace = () => {
    if (isSending || isVerifying) return
    if (step === 'phone') {
      setPhoneDigits((current) => removeLastPhoneDigit(current))
      return
    }
    setCodeDigits((current) => removeLastOtpDigit(current))
  }

  if (!isValidKycResumeState(kycState) || hasVerifiedPhone(user)) {
    return null
  }

  const phoneDisplay = formatPhoneFa(phoneDigits)
  const codeDisplay = formatOtpDisplay(codeDigits)
  const continueDisabled = step === 'phone' ? !canSend : !canVerify
  const continueLabel =
    step === 'phone'
      ? isSending
        ? 'در حال ارسال کد...'
        : 'ارسال کد تأیید'
      : isVerifying
        ? 'در حال تأیید...'
        : 'تأیید'

  return (
    <div className="stars-kyc-phone" style={getKycThemeStyle(kycState.product)}>
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader
          title="تأیید سریع هویت"
          onBack={handleBack}
          action={<span className="page-header__step">مرحله ۱ از ۳</span>}
        />
      </div>

      <div className="stars-kyc-phone__body">
        <section
          className="stars-kyc-phone__notice shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <p className="stars-kyc-phone__notice-text">
            برای جلوگیری از فیشینگ و سوءاستفاده، قبل از پرداخت یک احراز هویت کوتاه لازم است.
            اطلاعات شما فقط برای امنیت خرید ذخیره می‌شود و در خریدهای بعدی دوباره پرسیده نمی‌شود.
          </p>
        </section>

        <section
          className="stars-kyc-phone__stack shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="شماره موبایل و کد تأیید"
        >
          <button
            type="button"
            className={`stars-kyc-phone__block${
              step === 'phone'
                ? ' stars-kyc-phone__block--active'
                : ' stars-kyc-phone__block--compact'
            }`}
            onClick={() => {
              if (step !== 'phone') {
                haptic('light')
                setStep('phone')
                setCodeDigits('')
              }
            }}
          >
            <p className="stars-kyc-phone__label">شماره موبایل</p>
            <span
              className={`stars-kyc-phone__value${
                phoneDigits ? '' : ' stars-kyc-phone__value--placeholder'
              }`}
              dir="ltr"
            >
              {phoneDisplay}
            </span>
          </button>

          <div
            className={`stars-kyc-phone__block${
              step === 'otp'
                ? ' stars-kyc-phone__block--active'
                : ' stars-kyc-phone__block--compact'
            }`}
          >
            <p className="stars-kyc-phone__label">کد تأیید</p>
            <span
              className={`stars-kyc-phone__value stars-kyc-phone__value--otp${
                codeDigits ? '' : ' stars-kyc-phone__value--placeholder'
              }`}
              dir="ltr"
            >
              {codeDisplay}
            </span>

            {step === 'otp' ? (
              <div className="stars-kyc-phone__resend">
                {resendSeconds > 0 ? (
                  <p className="stars-kyc-phone__resend-timer">
                    ارسال مجدد تا {formatCountdownFa(resendSeconds)}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="stars-kyc-phone__resend-btn"
                    disabled={isResending}
                    onClick={() => void handleResend()}
                  >
                    {isResending ? 'در حال ارسال...' : 'ارسال مجدد کد'}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {step === 'phone' && phoneError ? (
            <p className="stars-kyc-phone__error" role="alert">
              {phoneError}
            </p>
          ) : null}
        </section>

        <div
          className="stars-kyc-phone__keypad shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
        >
          <NumeralKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
        </div>
      </div>

      <footer
        className="stars-kyc-phone__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="stars-kyc-phone__continue"
          disabled={continueDisabled}
          onClick={handleContinue}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
