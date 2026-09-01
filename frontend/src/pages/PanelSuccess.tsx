import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import CopyIcon from '../components/icons/CopyIcon'
import { useTelegram } from '../hooks/useTelegram'
import type { PanelCredentialsState } from '../types/panel'
import '../styles/shop-rise.css'
import './PanelFlow.css'

export function PanelSuccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const state = location.state as PanelCredentialsState | null
  const credentials = state?.credentials
  const kind = state?.kind ?? 'trial'

  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  useEffect(() => {
    if (credentials) return
    navigate('/panel', { replace: true })
  }, [credentials, navigate])

  const copyText = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        haptic('light')
        setNotification({
          show: true,
          message: `${label} کپی شد`,
          type: 'success',
        })
      } catch {
        setNotification({
          show: true,
          message: 'کپی ناموفق بود',
          type: 'error',
        })
      }
    },
    [haptic],
  )

  if (!credentials) return null

  return (
    <div className="panel-flow">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="اطلاعات پنل" onBack={() => navigate('/')} />
      </div>

      <div className="panel-flow__content shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        <div className="panel-flow__steps">
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-done" />
        </div>

        <div className="panel-flow__summary">
          <h2 className="panel-flow__summary-title">
            {kind === 'trial'
              ? 'پنل تست با موفقیت ایجاد شد'
              : kind === 'reseller'
                ? 'پنل ریسلری با موفقیت ایجاد شد'
                : kind === 'import'
                  ? credentials.isReseller
                    ? 'پنل ریسلری با موفقیت به حساب شما منتقل شد'
                    : 'پنل مصرفی با موفقیت به حساب شما منتقل شد'
                  : 'پنل مصرفی با موفقیت فعال شد'}
          </h2>
          <p className="panel-flow__summary-desc">
            {credentials.upgradedFromTrial
              ? 'اکانت تست شما به پنل مصرفی ارتقا یافت. رمز عبور قبلی بدون تغییر حفظ شده است.'
              : kind === 'reseller'
                ? 'این پنل کیف پول جدا دارد. از داشبورد → پنل‌های من موجودی را به آن تخصیص دهید.'
                : kind === 'import'
                  ? 'از این پس مدیریت و شارژ این پنل از همین برنامه انجام می‌شود.'
                  : 'اطلاعات ورود زیر را کپی و ذخیره کنید. رمز عبور تولید شده فقط در این مرحله قابل مشاهده است.'}
          </p>
        </div>

        <div className="panel-flow__creds">
          <div className="panel-flow__cred-field">
            <span className="panel-flow__cred-field-label">آدرس ورود به پنل</span>
            <button
              type="button"
              className="panel-flow__cred-box"
              onClick={() => void copyText(credentials.panelUrl, 'آدرس پنل')}
            >
              <span className="panel-flow__cred-value">{credentials.panelUrl}</span>
              <span className="panel-flow__cred-copy-badge">
                <CopyIcon width={12} height={12} color="currentColor" />
                <span>کپی</span>
              </span>
            </button>
          </div>

          <div className="panel-flow__creds-row">
            <div className="panel-flow__cred-field">
              <span className="panel-flow__cred-field-label">نام کاربری</span>
              <button
                type="button"
                className="panel-flow__cred-box"
                onClick={() => void copyText(credentials.username, 'نام کاربری')}
              >
                <span className="panel-flow__cred-value">{credentials.username}</span>
                <span className="panel-flow__cred-copy-badge">
                  <CopyIcon width={12} height={12} color="currentColor" />
                  <span>کپی</span>
                </span>
              </button>
            </div>

            <div className="panel-flow__cred-field">
              <span className="panel-flow__cred-field-label">رمز عبور</span>
              {credentials.password ? (
                <button
                  type="button"
                  className="panel-flow__cred-box"
                  onClick={() => void copyText(credentials.password!, 'رمز عبور')}
                >
                  <span className="panel-flow__cred-value">{credentials.password}</span>
                  <span className="panel-flow__cred-copy-badge">
                    <CopyIcon width={12} height={12} color="currentColor" />
                    <span>کپی</span>
                  </span>
                </button>
              ) : (
                <div className="panel-flow__cred-box panel-flow__cred-box--static">
                  <span
                    className="panel-flow__cred-value"
                    style={{ direction: 'rtl', fontSize: '12px', color: 'var(--text-muted)' }}
                  >
                    رمز قبلی اکانت
                  </span>
                </div>
              )}
            </div>
          </div>

          {credentials.volumeGb ? (
            <div className="panel-flow__cred-field">
              <span className="panel-flow__cred-field-label">حجم تست رایگان</span>
              <div className="panel-flow__cred-box panel-flow__cred-box--static">
                <span
                  className="panel-flow__cred-value"
                  style={{ direction: 'rtl', fontSize: '13px', fontWeight: 600 }}
                >
                  {credentials.volumeGb} گیگابایت
                </span>
              </div>
            </div>
          ) : null}

          {credentials.prepaidGb ? (
            <div className="panel-flow__cred-field">
              <span className="panel-flow__cred-field-label">حجم پرداخت‌شده</span>
              <div className="panel-flow__cred-box panel-flow__cred-box--static">
                <span className="panel-flow__cred-value panel-flow__cred-value--fa">
                  {`تا ${Number(credentials.prepaidGb).toLocaleString('fa-IR', {
                    maximumFractionDigits: 1,
                    minimumFractionDigits: 0,
                  })} گیگابایت پرداخت کرده‌اید. از این مقدار به بعد از ${
                    credentials.isReseller ? 'کیف پول همین پنل' : 'کیف پول شما'
                  } کسر می‌شود.`}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <footer
        className="panel-flow__footer panel-flow__footer--row shop-rise"
        style={{ '--rise-index': 2 } as CSSProperties}
      >
        <button
          type="button"
          className="panel-flow__btn--ghost panel-flow__footer-btn"
          onClick={() => {
            haptic('light')
            navigate('/')
          }}
        >
          بازگشت به فروشگاه
        </button>
        <button
          type="button"
          className="panel-flow__continue panel-flow__footer-btn"
          onClick={() => {
            haptic('light')
            navigate('/dashboard')
          }}
        >
          ورود به داشبورد
        </button>
      </footer>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />
    </div>
  )
}
