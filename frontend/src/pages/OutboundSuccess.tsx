import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import CopyIcon from '../components/icons/CopyIcon'
import { useTelegram } from '../hooks/useTelegram'
import type { OutboundCredentialsState } from '../lib/outboundApi'
import '../styles/shop-rise.css'
import './PanelFlow.css'

export function OutboundSuccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const state = location.state as OutboundCredentialsState | null
  const credentials = state?.credentials
  const kind = state?.kind ?? 'volume'

  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  useEffect(() => {
    if (credentials) return
    navigate('/outbound', { replace: true })
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
        <PageHeader title="اطلاعات سرویس" onBack={() => navigate('/dashboard/outbound')} />
      </div>

      <div className="panel-flow__content shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        <div className="panel-flow__steps">
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-done" />
        </div>

        <div className="panel-flow__summary">
          <h2 className="panel-flow__summary-title">
            {kind === 'volume' ? 'اوتباند حجمی با موفقیت فعال شد' : 'اوتباند مصرفی با موفقیت فعال شد'}
          </h2>
          <p className="panel-flow__summary-desc">
            {kind === 'volume'
              ? 'لینک اتصال را کپی کنید و در کلاینت VPN خود وارد نمایید.'
              : 'لینک اتصال را ذخیره کنید. هزینه مصرف به‌صورت دوره‌ای از موجودی کیف پول شما کسر می‌شود.'}
          </p>
        </div>

        <div className="panel-flow__creds">
          <div className="panel-flow__cred-field">
            <span className="panel-flow__cred-field-label">نام سرویس</span>
            <button
              type="button"
              className="panel-flow__cred-box"
              onClick={() => void copyText(credentials.clientUsername, 'نام سرویس')}
            >
              <span className="panel-flow__cred-value panel-flow__credential-value--mono">
                {credentials.clientUsername}
              </span>
              <span className="panel-flow__cred-copy-badge">
                <CopyIcon width={12} height={12} color="currentColor" />
                <span>کپی</span>
              </span>
            </button>
          </div>

          {credentials.connectionLink ? (
            <div className="panel-flow__cred-field">
              <span className="panel-flow__cred-field-label">لینک اتصال</span>
              <button
                type="button"
                className="panel-flow__cred-box panel-flow__cred-box--multiline"
                onClick={() => void copyText(credentials.connectionLink, 'لینک اتصال')}
              >
                <span
                  className="panel-flow__cred-value panel-flow__credential-value--link"
                  title={credentials.connectionLink}
                >
                  {credentials.connectionLink}
                </span>
                <span className="panel-flow__cred-copy-badge">
                  <CopyIcon width={12} height={12} color="currentColor" />
                  <span>کپی</span>
                </span>
              </button>
            </div>
          ) : null}

          {kind === 'volume' && credentials.volumeGb ? (
            <div className="panel-flow__cred-field">
              <span className="panel-flow__cred-field-label">حجم خریداری‌شده</span>
              <div className="panel-flow__cred-box panel-flow__cred-box--static">
                <span
                  className="panel-flow__cred-value panel-flow__cred-value--fa"
                  style={{ fontWeight: 600 }}
                >
                  {Number(credentials.volumeGb).toLocaleString('fa-IR')} گیگابایت
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {kind === 'usage' ? (
          <div className="panel-flow__info-box">
            <p className="panel-flow__info-box-title">نکته مصرفی</p>
            <p className="panel-flow__info-box-desc">
              تا زمانی که موجودی کافی داشته باشید سرویس فعال می‌ماند. جزئیات و مدیریت از بخش
              «سرویس‌های من» در دسترس است.
            </p>
          </div>
        ) : null}
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
            navigate('/outbound')
          }}
        >
          خرید مجدد
        </button>
        <button
          type="button"
          className="panel-flow__continue panel-flow__footer-btn"
          onClick={() => {
            haptic('light')
            navigate('/dashboard/outbound')
          }}
        >
          سرویس‌های من
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
