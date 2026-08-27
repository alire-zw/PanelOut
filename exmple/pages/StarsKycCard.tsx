import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { NumeralKeypad } from '../components/NumeralKeypad'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { detectBankFromCardDigits } from '../lib/bankDetect'
import { hasKycIdentity, hasVerifiedPhone } from '../lib/kyc'
import { saveKycCard } from '../lib/kycApi'
import {
  appendCardDigit,
  formatCardNumberFa,
  isValidCardNumberLength,
  removeLastCardDigit,
} from '../lib/card'
import type { KycResumeState } from '../types/kycFlow'
import { isValidKycResumeState } from '../lib/kycFlow'
import { getKycThemeStyle } from '../lib/kycTheme'
import '../styles/shop-rise.css'
import './StarsKycCard.css'

export function StarsKycCardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const { user } = useUser()
  const kycState = location.state as KycResumeState | null
  const [cardDigits, setCardDigits] = useState(() => kycState?.cardDigits ?? '')
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

    if (user && !hasVerifiedPhone(user) && !kycState.phoneJustVerified) {
      navigate('/stars/kyc/phone', { replace: true, state: kycState })
      return
    }

    if (user && !hasKycIdentity(user) && !kycState.identityJustSaved) {
      navigate('/stars/kyc/identity', { replace: true, state: kycState })
    }
  }, [kycState, navigate, user])

  const handleBack = useCallback(() => {
    if (!isValidKycResumeState(kycState)) {
      navigate('/', { replace: true })
      return
    }

    navigate('/stars/kyc/identity', { replace: true, state: kycState })
  }, [kycState, navigate])

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

  const cardDisplay = useMemo(() => formatCardNumberFa(cardDigits), [cardDigits])
  const detectedBank = useMemo(() => {
    const bank = detectBankFromCardDigits(cardDigits)
    if (!bank || bank.slug === 'unknown') return null
    return bank
  }, [cardDigits])
  const canContinue = isValidCardNumberLength(cardDigits) && !isSubmitting

  const handleContinue = async () => {
    if (!canContinue || !isValidKycResumeState(kycState)) return
    haptic('light')
    setIsSubmitting(true)

    try {
      await saveKycCard({
        cardNumber: cardDigits,
        bankName: detectedBank?.nameFa,
        bankSlug: detectedBank?.slug,
        bankBin: detectedBank?.bin ?? cardDigits.slice(0, 6),
      })

      navigate('/stars/kyc/terms', {
        replace: true,
        state: {
          ...kycState,
          cardDigits,
        },
      })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'ثبت کارت ناموفق بود',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (
    !isValidKycResumeState(kycState) ||
    (user && !hasVerifiedPhone(user) && !kycState.phoneJustVerified) ||
    (user && !hasKycIdentity(user) && !kycState.identityJustSaved)
  ) {
    return null
  }

  return (
    <div className="stars-kyc-card" style={getKycThemeStyle(kycState.product)}>
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader
          title="شماره کارت"
          onBack={handleBack}
          action={<span className="page-header__step">مرحله ۳ از ۳</span>}
        />
      </div>

      <div className="stars-kyc-card__body">
        <section
          className="stars-kyc-card__notice shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <p className="stars-kyc-card__notice-text">
            پرداخت در درگاه فقط با این شماره کارت امکان‌پذیر است. در آینده می‌توانید از بخش پروفایل
            کارت‌های بیشتری اضافه کنید.
          </p>
        </section>

        <section
          className="stars-kyc-card__amount shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="شماره کارت"
        >
          <p className="stars-kyc-card__label">شماره کارت</p>
          <div className="stars-kyc-card__value-row">
            <span
              className={`stars-kyc-card__value${
                cardDigits ? '' : ' stars-kyc-card__value--placeholder'
              }`}
              dir="ltr"
            >
              {cardDisplay}
            </span>
          </div>
          <div
            className={`stars-kyc-card__bank${
              detectedBank ? ' stars-kyc-card__bank--visible' : ''
            }`}
            aria-live="polite"
          >
            {detectedBank ? (
              <>
                <img
                  className="stars-kyc-card__bank-icon"
                  src={detectedBank.iconSrc}
                  alt=""
                  width={18}
                  height={18}
                />
                <span className="stars-kyc-card__bank-name">{detectedBank.nameFa}</span>
              </>
            ) : null}
          </div>
        </section>

        <div
          className="stars-kyc-card__keypad shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
        >
          <NumeralKeypad
            onDigit={(digit) => setCardDigits((current) => appendCardDigit(current, digit))}
            onBackspace={() => setCardDigits((current) => removeLastCardDigit(current))}
          />
        </div>
      </div>

      <footer
        className="stars-kyc-card__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="stars-kyc-card__continue"
          disabled={!canContinue}
          onClick={() => void handleContinue()}
        >
          {isSubmitting ? 'در حال ثبت...' : 'ادامه'}
        </button>
      </footer>
    </div>
  )
}
