import { useCallback, useEffect, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
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

  useEffect(() => {
    if (credentials) return
    navigate('/panel', { replace: true })
  }, [credentials, navigate])

  const copyText = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        haptic('light')
      } catch {
        // ignore clipboard failures
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
            {kind === 'trial' ? 'پنل تست با موفقیت ایجاد شد' : 'پنل مصرفی با موفقیت فعال شد'}
          </h2>
          <p className="panel-flow__summary-desc">
            {credentials.upgradedFromTrial
              ? 'اکانت تست شما به پنل مصرفی ارتقا یافت. رمز عبور قبلی بدون تغییر حفظ شده است.'
              : 'اطلاعات ورود زیر را کپی و ذخیره کنید. رمز عبور تولید شده فقط در این مرحله قابل مشاهده است.'}
          </p>
        </div>

        <div className="panel-flow__creds">
          <button
            type="button"
            className="panel-flow__cred-item"
            onClick={() => void copyText(credentials.panelUrl)}
          >
            <span className="panel-flow__cred-label">آدرس پنل</span>
            <div className="panel-flow__cred-value-wrap">
              <span className="panel-flow__cred-value">{credentials.panelUrl}</span>
              <span className="panel-flow__cred-copy-badge">کپی</span>
            </div>
          </button>

          <button
            type="button"
            className="panel-flow__cred-item"
            onClick={() => void copyText(credentials.username)}
          >
            <span className="panel-flow__cred-label">نام کاربری</span>
            <div className="panel-flow__cred-value-wrap">
              <span className="panel-flow__cred-value">{credentials.username}</span>
              <span className="panel-flow__cred-copy-badge">کپی</span>
            </div>
          </button>

          {credentials.password ? (
            <button
              type="button"
              className="panel-flow__cred-item"
              onClick={() => void copyText(credentials.password!)}
            >
              <span className="panel-flow__cred-label">رمز عبور</span>
              <div className="panel-flow__cred-value-wrap">
                <span className="panel-flow__cred-value">{credentials.password}</span>
                <span className="panel-flow__cred-copy-badge">کپی</span>
              </div>
            </button>
          ) : (
            <div className="panel-flow__cred-item panel-flow__cred-item--static">
              <span className="panel-flow__cred-label">رمز عبور</span>
              <div className="panel-flow__cred-value-wrap">
                <span className="panel-flow__cred-value">رمز عبور قبلی اکانت</span>
              </div>
            </div>
          )}

          {credentials.volumeGb ? (
            <div className="panel-flow__cred-item panel-flow__cred-item--static">
              <span className="panel-flow__cred-label">حجم تست رایگان</span>
              <div className="panel-flow__cred-value-wrap">
                <span className="panel-flow__cred-value">{credentials.volumeGb} گیگابایت</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="panel-flow__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        <button
          type="button"
          className="panel-flow__continue"
          onClick={() => {
            haptic('light')
            window.open(credentials.panelUrl, '_blank', 'noopener,noreferrer')
          }}
        >
          ورود به پنل
        </button>
        <button
          type="button"
          className="panel-flow__btn--ghost"
          onClick={() => {
            haptic('light')
            navigate('/')
          }}
        >
          بازگشت به فروشگاه
        </button>
      </footer>
    </div>
  )
}
