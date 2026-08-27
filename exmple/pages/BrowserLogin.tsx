import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { NumeralKeypad } from '../components/NumeralKeypad'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { sendBrowserLoginOtp, verifyBrowserLoginOtp } from '../lib/browserAuthApi'
import {
  isBrowserPublicMode,
  setBrowserSession,
} from '../lib/browserSession'
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
import '../styles/shop-rise.css'
import './StarsKycPhone.css'
import './BrowserLogin.css'

type LoginStep = 'phone' | 'otp'

export function BrowserLoginPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { isAuthenticated, refetch } = useUser()

  const [step, setStep] = useState<LoginStep>('phone')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [codeDigits, setCodeDigits] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const verifyingRef = useRef(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const enabled = isBrowserPublicMode() && !isTelegramWebApp()

  useEffect(() => {
    if (!enabled) return
    if (resendSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [enabled, resendSeconds])

  const handleBack = useCallback(() => {
    if (step === 'otp') {
      haptic('light')
      setStep('phone')
      setCodeDigits('')
      return
    }
    navigate('/', { replace: true })
  }, [haptic, navigate, step])

  const phoneError = useMemo(() => getPhoneInputError(phoneDigits), [phoneDigits])
  const canSend = isValidIrMobile(phoneDigits) && !isSending

  const showError = (message: string) => {
    setNotification({ show: true, message, type: 'error' })
  }

  const sendCode = async (isResend = false) => {
    if (!isValidIrMobile(phoneDigits)) {
      showError(phoneError || 'شماره موبایل معتبر نیست')
      return
    }

    if (isResend) setIsResending(true)
    else setIsSending(true)

    try {
      const result = await sendBrowserLoginOtp(phoneDigits)
      setResendSeconds(result.resendAvailableInSeconds)
      setStep('otp')
      setCodeDigits('')
      haptic('light')
      if (result.alreadySent) {
        setNotification({
          show: true,
          message: 'کد قبلی هنوز معتبر است',
          type: 'info',
        })
      }
    } catch (error) {
      const err = error as Error & { retryAfterSeconds?: number }
      if (typeof err.retryAfterSeconds === 'number' && err.retryAfterSeconds > 0) {
        setResendSeconds(err.retryAfterSeconds)
      }
      showError(err.message || 'ارسال کد ناموفق بود')
    } finally {
      setIsSending(false)
      setIsResending(false)
    }
  }

  const verifyCode = useCallback(
    async (code: string) => {
      if (verifyingRef.current || code.length !== OTP_CODE_LENGTH) return
      verifyingRef.current = true
      setIsVerifying(true)

      try {
        const result = await verifyBrowserLoginOtp(phoneDigits, code)
        setBrowserSession({
          token: result.token,
          expiresAt: result.expiresAt,
        })
        await refetch({ silent: true })
        haptic('medium')
        navigate('/', { replace: true })
      } catch (error) {
        showError(error instanceof Error ? error.message : 'تأیید کد ناموفق بود')
        setCodeDigits('')
      } finally {
        verifyingRef.current = false
        setIsVerifying(false)
      }
    },
    [haptic, navigate, phoneDigits, refetch],
  )

  useEffect(() => {
    if (step !== 'otp') return
    if (codeDigits.length !== OTP_CODE_LENGTH) return
    void verifyCode(codeDigits)
  }, [codeDigits, step, verifyCode])

  if (!enabled) {
    return <Navigate to="/" replace />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="stars-kyc-phone browser-login">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title={step === 'otp' ? 'کد تأیید' : 'ورود با پیامک'} onBack={handleBack} />
      </div>

      <div className="stars-kyc-phone__body">
        <div className="stars-kyc-phone__notice shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <p className="stars-kyc-phone__notice-text">
            ورود موقت مرورگر برای بررسی سایت. شماره موبایل خود را وارد کنید تا کد پیامکی ارسال شود.
          </p>
        </div>

        <div className="stars-kyc-phone__stack shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          {step === 'phone' ? (
            <div className="stars-kyc-phone__block stars-kyc-phone__block--active">
              <span className="stars-kyc-phone__label">شماره موبایل</span>
              <strong className="stars-kyc-phone__value" dir="ltr">
                {formatPhoneFa(phoneDigits) || '۰۹·········'}
              </strong>
              {phoneError ? <span className="stars-kyc-phone__hint">{phoneError}</span> : null}
              <button
                type="button"
                className="browser-login__submit"
                disabled={!canSend}
                onClick={() => void sendCode(false)}
              >
                {isSending ? 'در حال ارسال…' : 'دریافت کد'}
              </button>
            </div>
          ) : (
            <div className="stars-kyc-phone__block stars-kyc-phone__block--active">
              <span className="stars-kyc-phone__label">کد ارسال‌شده به {formatPhoneFa(phoneDigits)}</span>
              <strong className="stars-kyc-phone__value" dir="ltr">
                {formatOtpDisplay(codeDigits)}
              </strong>
              <button
                type="button"
                className="browser-login__resend"
                disabled={resendSeconds > 0 || isResending || isVerifying}
                onClick={() => void sendCode(true)}
              >
                {resendSeconds > 0
                  ? `ارسال مجدد تا ${formatCountdownFa(resendSeconds)}`
                  : isResending
                    ? 'در حال ارسال…'
                    : 'ارسال مجدد کد'}
              </button>
              {isVerifying ? <span className="stars-kyc-phone__hint">در حال بررسی…</span> : null}
            </div>
          )}
        </div>

        <div className="shop-rise" style={{ '--rise-index': 3 } as CSSProperties}>
          <NumeralKeypad
            onDigit={(digit) => {
              haptic('light')
              if (step === 'phone') {
                setPhoneDigits((prev) => appendPhoneDigit(prev, digit))
              } else {
                setCodeDigits((prev) => appendOtpDigit(prev, digit))
              }
            }}
            onBackspace={() => {
              haptic('light')
              if (step === 'phone') {
                setPhoneDigits((prev) => removeLastPhoneDigit(prev))
              } else {
                setCodeDigits((prev) => removeLastOtpDigit(prev))
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
