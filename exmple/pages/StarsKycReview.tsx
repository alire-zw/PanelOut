import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import BankCardIcon from '../components/icons/BankCardIcon'
import IdIcon from '../components/icons/IdIcon'
import IdNotVerifiedIcon from '../components/icons/id-not-verified-stroke-rounded'
import IdVerifiedIcon from '../components/icons/id-verified-stroke-rounded'
import PhoneIcon from '../components/icons/PhoneIcon'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { verifyKycCardMatch, verifyKycShahkar } from '../lib/kycApi'
import type { KycResumeState } from '../types/kycFlow'
import {
  getKycCatalogPath,
  getKycConfirmPath,
  isValidKycResumeState,
  toKycConfirmState,
  toKycEditRestoreState,
} from '../lib/kycFlow'
import { getKycThemeStyle } from '../lib/kycTheme'
import '../styles/shop-rise.css'
import './StarsKycReview.css'

type CheckStatus = 'idle' | 'pending' | 'success' | 'error'
type ReviewPhase = 'checking' | 'collapsing' | 'complete'

type ReviewCheck = {
  id: 'mobile' | 'mobile-national' | 'card-national'
  title: string
  status: CheckStatus
  Icon: ComponentType<{ width?: number; height?: number; color?: string }>
}

function statusLabel(status: CheckStatus): string {
  if (status === 'success') return 'تأیید شد'
  if (status === 'error') return 'ناموفق'
  if (status === 'idle') return 'در انتظار'
  return 'در حال بررسی'
}

const COLLAPSE_MS = 520

export function StarsKycReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const { refetch } = useUser()
  const kycState = location.state as KycResumeState | null
  const [phase, setPhase] = useState<ReviewPhase>('checking')
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })
  const [checks, setChecks] = useState<ReviewCheck[]>([
    {
      id: 'mobile',
      title: 'تأیید شماره موبایل',
      status: 'success',
      Icon: PhoneIcon,
    },
    {
      id: 'mobile-national',
      title: 'تطابق شماره موبایل و کد ملی',
      status: 'pending',
      Icon: IdIcon,
    },
    {
      id: 'card-national',
      title: 'تطابق شماره کارت و کد ملی',
      status: 'idle',
      Icon: BankCardIcon,
    },
  ])
  const startedRef = useRef(false)

  const allPassed = checks.every((check) => check.status === 'success')
  const canPay = phase === 'complete'

  const setCheckStatus = useCallback((id: ReviewCheck['id'], status: CheckStatus) => {
    setChecks((current) =>
      current.map((check) => (check.id === id ? { ...check, status } : check)),
    )
  }, [])

  useEffect(() => {
    if (!allPassed) return
    if (phase === 'complete') return

    setPhase('collapsing')
    const timer = window.setTimeout(() => {
      setPhase('complete')
      haptic('medium')
    }, COLLAPSE_MS)

    return () => window.clearTimeout(timer)
  }, [allPassed, haptic, phase])

  useEffect(() => {
    if (!isValidKycResumeState(kycState)) {
      navigate('/', { replace: true })
      return
    }

    if (startedRef.current) return
    startedRef.current = true

    let cancelled = false

    const run = async () => {
      try {
        await verifyKycShahkar()
        if (cancelled) return
        setCheckStatus('mobile-national', 'success')
        setCheckStatus('card-national', 'pending')

        await verifyKycCardMatch(kycState.cardDigits)
        if (cancelled) return
        setCheckStatus('card-national', 'success')
        await refetch({ silent: true })
      } catch (error) {
        if (cancelled) return

        const message =
          error instanceof Error ? error.message : 'بررسی احراز هویت ناموفق بود'

        setChecks((current) => {
          const next = [...current]
          const activeIndex = next.findIndex(
            (check) => check.status === 'pending' || check.status === 'idle',
          )
          if (activeIndex >= 0) {
            next[activeIndex] = { ...next[activeIndex], status: 'error' }
          }
          return next
        })

        setNotification({
          show: true,
          message,
          type: 'error',
        })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [kycState, navigate, refetch, setCheckStatus])

  const handleBack = useCallback(() => {
    navigate('/', { replace: true })
  }, [navigate])

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

  const confirmState = isValidKycResumeState(kycState) ? toKycConfirmState(kycState) : null

  const handlePay = () => {
    if (!isValidKycResumeState(kycState) || !confirmState || !canPay) return
    haptic('light')
    navigate(getKycConfirmPath(kycState.product, kycState), {
      replace: true,
      state: confirmState,
    })
  }

  const handleEdit = () => {
    if (!isValidKycResumeState(kycState)) return
    haptic('light')
    navigate(getKycCatalogPath(kycState.product, kycState), {
      replace: true,
      state: toKycEditRestoreState(kycState),
    })
  }

  if (!isValidKycResumeState(kycState) || !confirmState) {
    return null
  }

  return (
    <div className="stars-kyc-review" style={getKycThemeStyle(kycState.product)}>
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="بررسی احراز هویت" onBack={handleBack} />
      </div>

      <div className="stars-kyc-review__content">
        {phase !== 'complete' && (
          <>
            <h2
              className={`stars-kyc-review__section-title shop-rise${
                phase === 'collapsing' ? ' stars-kyc-review__section-title--fade' : ''
              }`}
              style={{ '--rise-index': 1 } as CSSProperties}
            >
              وضعیت بررسی‌ها
            </h2>

            <section
              className={`stars-kyc-review__checks shop-rise${
                phase === 'collapsing' ? ' stars-kyc-review__checks--collapsing' : ''
              }`}
              style={{ '--rise-index': 2 } as CSSProperties}
              aria-label="وضعیت بررسی‌ها"
            >
              {checks.map((check, index) => {
                const { Icon } = check
                return (
                  <div
                    key={check.id}
                    className={`stars-kyc-review__check stars-kyc-review__check--${check.status}`}
                    style={{ '--check-index': index } as CSSProperties}
                  >
                    <span className="stars-kyc-review__check-icon" aria-hidden>
                      <Icon width={18} height={18} />
                    </span>
                    <div className="stars-kyc-review__check-text">
                      <span className="stars-kyc-review__check-title">{check.title}</span>
                      <span className="stars-kyc-review__check-status">
                        {statusLabel(check.status)}
                      </span>
                    </div>
                    <span className="stars-kyc-review__check-indicator" aria-hidden>
                      {check.status === 'pending' ? (
                        <span className="stars-kyc-review__pulse-dot" />
                      ) : check.status === 'success' ? (
                        <IdVerifiedIcon width={20} height={20} />
                      ) : check.status === 'error' ? (
                        <IdNotVerifiedIcon width={20} height={20} />
                      ) : (
                        <span className="stars-kyc-review__idle-dot" />
                      )}
                    </span>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {phase === 'complete' && (
          <section
            className="stars-kyc-review__done shop-rise"
            style={{ '--rise-index': 1 } as CSSProperties}
            aria-live="polite"
          >
            <span className="stars-kyc-review__done-icon" aria-hidden>
              <IdVerifiedIcon width={28} height={28} />
            </span>
            <p className="stars-kyc-review__done-title">
              {kycState.product === 'wallet-charge'
                ? 'احراز هویت شما تکمیل شد و حالا می‌توانید شارژ کیف پول را انجام دهید'
                : 'احراز هویت شما تکمیل شد و حالا می‌توانید پرداخت سفارش خود را انجام دهید'}
            </p>
            <p className="stars-kyc-review__done-text">
              همچنین در دفعات بعدی نیازی به احراز مجدد نیست و اطلاعات شما ذخیره شد
            </p>
          </section>
        )}
      </div>

      <footer
        className="stars-kyc-review__footer shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
      >
        <button
          type="button"
          className="stars-kyc-review__pay"
          onClick={handlePay}
          disabled={!canPay}
        >
          {kycState.product === 'wallet-charge' ? 'ادامه پرداخت' : 'پرداخت سفارش'}
        </button>
        <button type="button" className="stars-kyc-review__edit" onClick={handleEdit}>
          {kycState.product === 'wallet-charge' ? 'ویرایش مبلغ' : 'ویرایش سفارش'}
        </button>
      </footer>
    </div>
  )
}
