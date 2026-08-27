import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { NumeralKeypad } from '../components/NumeralKeypad'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { hasKycIdentity, hasVerifiedPhone } from '../lib/kyc'
import { completeKycIdentity } from '../lib/kycApi'
import {
  appendBirthDigit,
  appendNationalIdDigit,
  formatBirthDateFa,
  formatBirthDateInput,
  formatNationalIdFa,
  getBirthDateError,
  getNationalIdError,
  isValidIranNationalId,
  isValidJalaliBirthInput,
  removeLastBirthDigit,
  removeLastNationalIdDigit,
} from '../lib/identity'
import type { KycResumeState } from '../types/kycFlow'
import {
  getKycConfirmPath,
  isValidKycResumeState,
  toKycConfirmState,
} from '../lib/kycFlow'
import { getKycThemeStyle } from '../lib/kycTheme'
import '../styles/shop-rise.css'
import './StarsKycIdentity.css'

type IdentityStep = 'nationalId' | 'birthDate'

export function StarsKycIdentityPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const { user, refetch } = useUser()
  const kycState = location.state as KycResumeState | null

  const [step, setStep] = useState<IdentityStep>('nationalId')
  const [nationalId, setNationalId] = useState('')
  const [birthDigits, setBirthDigits] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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

    const phoneReady = hasVerifiedPhone(user) || Boolean(kycState.phoneJustVerified)
    if (user && !phoneReady) {
      navigate('/stars/kyc/phone', { replace: true, state: kycState })
      return
    }

    if (user && hasKycIdentity(user) && !kycState.identityJustSaved) {
      navigate('/stars/kyc/card', { replace: true, state: kycState })
    }
  }, [kycState, navigate, user])

  const handleBack = useCallback(() => {
    if (!isValidKycResumeState(kycState)) {
      navigate('/', { replace: true })
      return
    }

    if (step === 'birthDate') {
      haptic('light')
      setStep('nationalId')
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

  const birthDate = useMemo(() => formatBirthDateInput(birthDigits), [birthDigits])
  const nationalIdError = useMemo(() => getNationalIdError(nationalId), [nationalId])
  const birthDateError = useMemo(() => getBirthDateError(birthDate), [birthDate])

  const canContinueNational = isValidIranNationalId(nationalId)
  const canContinueBirth = isValidJalaliBirthInput(birthDate) && !isSubmitting

  const handleSubmit = async () => {
    if (!canContinueBirth || !isValidKycResumeState(kycState)) return

    haptic('light')
    setIsSubmitting(true)

    try {
      await completeKycIdentity({ nationalId, birthDate })
      await refetch({ silent: true })

      navigate('/stars/kyc/card', {
        replace: true,
        state: {
          ...kycState,
          identityJustSaved: true,
        },
      })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'ثبت اطلاعات ناموفق بود',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleContinue = () => {
    if (step === 'nationalId') {
      if (!canContinueNational) return
      haptic('light')
      setStep('birthDate')
      return
    }

    void handleSubmit()
  }

  const handleDigit = (digit: string) => {
    if (isSubmitting) return
    if (step === 'nationalId') {
      setNationalId((current) => appendNationalIdDigit(current, digit))
      return
    }
    setBirthDigits((current) => appendBirthDigit(current, digit))
  }

  const handleBackspace = () => {
    if (isSubmitting) return
    if (step === 'nationalId') {
      setNationalId((current) => removeLastNationalIdDigit(current))
      return
    }
    setBirthDigits((current) => removeLastBirthDigit(current))
  }

  if (
    !isValidKycResumeState(kycState) ||
    (user && !hasVerifiedPhone(user) && !kycState.phoneJustVerified) ||
    (user && hasKycIdentity(user) && !kycState.identityJustSaved)
  ) {
    return null
  }

  const nationalDisplay = formatNationalIdFa(nationalId)
  const birthDisplay = formatBirthDateFa(birthDigits)
  const activeError = step === 'nationalId' ? nationalIdError : birthDateError
  const continueDisabled = step === 'nationalId' ? !canContinueNational : !canContinueBirth
  const continueLabel =
    step === 'nationalId' ? 'ادامه' : isSubmitting ? 'در حال ثبت...' : 'تأیید و ادامه'

  return (
    <div className="stars-kyc-identity" style={getKycThemeStyle(kycState.product)}>
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader
          title="اطلاعات هویتی"
          onBack={handleBack}
          action={<span className="page-header__step">مرحله ۲ از ۳</span>}
        />
      </div>

      <div className="stars-kyc-identity__body">
        <section
          className="stars-kyc-identity__notice shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <p className="stars-kyc-identity__notice-text">
            لطفاً کد ملی و تاریخ تولد را دقیقاً مطابق کارت ملی وارد کنید تا در ادامه احراز هویت
            به مشکل نخورید. اطلاعات شما نزد ما کاملاً محفوظ است و فقط برای امنیت خرید استفاده می‌شود.
          </p>
        </section>

        <section
          className="stars-kyc-identity__stack shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="کد ملی و تاریخ تولد"
        >
          <button
            type="button"
            className={`stars-kyc-identity__block${
              step === 'nationalId'
                ? ' stars-kyc-identity__block--active'
                : ' stars-kyc-identity__block--compact'
            }`}
            onClick={() => {
              if (step !== 'nationalId') {
                haptic('light')
                setStep('nationalId')
              }
            }}
          >
            <p className="stars-kyc-identity__label">کد ملی</p>
            <span
              className={`stars-kyc-identity__value${
                nationalId ? '' : ' stars-kyc-identity__value--placeholder'
              }`}
              dir="ltr"
            >
              {nationalDisplay}
            </span>
          </button>

          <div
            className={`stars-kyc-identity__block${
              step === 'birthDate'
                ? ' stars-kyc-identity__block--active'
                : ' stars-kyc-identity__block--compact'
            }`}
          >
            <p className="stars-kyc-identity__label">تاریخ تولد</p>
            <span
              className={`stars-kyc-identity__value${
                birthDigits ? '' : ' stars-kyc-identity__value--placeholder'
              }`}
              dir="ltr"
            >
              {birthDisplay}
            </span>
          </div>

          {activeError ? (
            <p className="stars-kyc-identity__error" role="alert">
              {activeError}
            </p>
          ) : null}
        </section>

        <div
          className="stars-kyc-identity__keypad shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
        >
          <NumeralKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
        </div>
      </div>

      <footer
        className="stars-kyc-identity__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="stars-kyc-identity__continue"
          disabled={continueDisabled}
          onClick={handleContinue}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  )
}
