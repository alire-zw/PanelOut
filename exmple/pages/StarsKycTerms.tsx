import { useCallback, useEffect, useRef, useState, type CSSProperties, type UIEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { hasKycIdentity, hasVerifiedPhone } from '../lib/kyc'
import { acceptKycTerms } from '../lib/kycApi'
import type { KycResumeState } from '../types/kycFlow'
import { isValidKycResumeState } from '../lib/kycFlow'
import { getKycThemeStyle } from '../lib/kycTheme'
import '../styles/shop-rise.css'
import './StarsKycTerms.css'

const SCROLL_BOTTOM_THRESHOLD_PX = 28

export function StarsKycTermsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const { user, refetch } = useUser()
  const kycState = location.state as KycResumeState | null
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasReachedBottom, setHasReachedBottom] = useState(false)
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
      return
    }

    if (!kycState.cardDigits) {
      navigate('/stars/kyc/card', { replace: true, state: kycState })
    }
  }, [kycState, navigate, user])

  const handleBack = useCallback(() => {
    if (!isValidKycResumeState(kycState)) {
      navigate('/', { replace: true })
      return
    }

    navigate('/stars/kyc/card', { replace: true, state: kycState })
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

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    if (el.scrollHeight <= el.clientHeight + SCROLL_BOTTOM_THRESHOLD_PX) {
      setHasReachedBottom(true)
      return
    }

    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setHasReachedBottom(true)
    }
  }, [])

  useEffect(() => {
    checkScrollPosition()
    const el = scrollRef.current
    if (!el) return

    const resizeObserver = new ResizeObserver(() => checkScrollPosition())
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [checkScrollPosition])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setHasReachedBottom(true)
    }
  }

  const handleAccept = async () => {
    if (!hasReachedBottom || isSubmitting || !isValidKycResumeState(kycState)) return

    haptic('light')
    setIsSubmitting(true)

    try {
      await acceptKycTerms()
      await refetch({ silent: true })

      navigate('/stars/kyc/review', { replace: true, state: kycState })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'ثبت پذیرش قوانین ناموفق بود',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (
    !isValidKycResumeState(kycState) ||
    (user && !hasVerifiedPhone(user) && !kycState.phoneJustVerified) ||
    (user && !hasKycIdentity(user) && !kycState.identityJustSaved) ||
    !kycState.cardDigits
  ) {
    return null
  }

  return (
    <div className="stars-kyc-terms" style={getKycThemeStyle(kycState.product)}>
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="قوانین و تعهدنامه" onBack={handleBack} />
      </div>

      <div className="stars-kyc-terms__body">
        <div
          ref={scrollRef}
          className="stars-kyc-terms__scroll shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          onScroll={handleScroll}
        >
          <article className="stars-kyc-terms__article">
            <h2 className="stars-kyc-terms__heading">شرایط استفاده</h2>
            <p>
              با استفاده از خدمات خرید استارز و سایر محصولات این مینی‌اپ، شما تأیید می‌کنید که
              اطلاعات ارائه‌شده متعلق به خود شماست و از سرویس فقط برای مقاصد قانونی استفاده
              می‌کنید. هرگونه سوءاستفاده، خرید صوری، یا تلاش برای دور زدن محدودیت‌های امنیتی
              می‌تواند منجر به مسدود شدن حساب شود.
            </p>
            <p>
              مسئولیت صحت شماره موبایل، کد ملی، تاریخ تولد و شماره کارت ثبت‌شده بر عهده کاربر
              است. پرداخت در درگاه بانکی فقط با کارت تأییدشده در فرآیند احراز هویت انجام می‌شود.
            </p>

            <h2 className="stars-kyc-terms__heading">حریم خصوصی</h2>
            <p>
              اطلاعات هویتی و بانکی شما صرفاً برای احراز هویت، جلوگیری از فیشینگ و افزایش امنیت
              خریدها ذخیره و پردازش می‌شود. این اطلاعات در اختیار اشخاص ثالث قرار نمی‌گیرد مگر در
              مواردی که قانون الزام کرده باشد یا برای تکمیل پرداخت از طریق درگاه بانکی ضروری باشد.
            </p>
            <p>
              ما از داده‌های شما برای تبلیغات ناخواسته استفاده نمی‌کنیم و دسترسی به اطلاعات حساس
              محدود به نیاز عملیاتی سرویس است.
            </p>

            <h2 className="stars-kyc-terms__heading">تعهدنامه ضد فیشینگ</h2>
            <p>کاربر متعهد می‌شود که:</p>
            <ul className="stars-kyc-terms__list">
              <li>
                حساب تلگرام، رمزها، کدهای یکبارمصرف و اطلاعات ورود را در اختیار هیچ فرد یا
                مجموعه‌ای قرار ندهد.
              </li>
              <li>
                لینک‌ها، ربات‌ها یا صفحه‌های جعلی که خود را به جای این سرویس معرفی می‌کنند را
                باز نکند و اطلاعات خود را در آن‌ها وارد نکند.
              </li>
              <li>
                دسترسی به کیف پول و کارت بانکی ثبت‌شده را به دیگران نسپارد و در صورت مشاهده هرگونه
                فعالیت مشکوک، فوراً پشتیبانی را مطلع کند.
              </li>
              <li>
                از درخواست دیگران برای خرید به‌نام او، دریافت کد پیامکی، یا انجام پرداخت به بهانه
                جایزه و شارژ رایگان خودداری کند.
              </li>
            </ul>
            <p>
              با پذیرش این تعهدنامه، تأیید می‌کنید که از ریسک‌های فیشینگ آگاه هستید و مسئولیت
              هرگونه افشای اطلاعات حساب یا همکاری در سوءاستفاده بر عهده شماست. نقض این تعهد می‌تواند
              منجر به لغو سفارش، مسدودسازی حساب و پیگیری قانونی شود.
            </p>
            <p className="stars-kyc-terms__end">پایان متن قوانین و تعهدنامه</p>
          </article>
        </div>

        {!hasReachedBottom ? <div className="stars-kyc-terms__fade" aria-hidden /> : null}
      </div>

      <footer
        className="stars-kyc-terms__footer shop-rise"
        style={{ '--rise-index': 2 } as CSSProperties}
      >
        <button
          type="button"
          className="stars-kyc-terms__continue"
          disabled={!hasReachedBottom || isSubmitting}
          onClick={() => void handleAccept()}
        >
          {isSubmitting ? 'در حال ثبت...' : 'قوانین و شرایط را می‌پذیرم'}
        </button>
      </footer>
    </div>
  )
}
