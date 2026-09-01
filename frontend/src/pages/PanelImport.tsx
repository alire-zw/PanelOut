import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import Agreement02Icon from '../components/icons/agreement-02-stroke-rounded'
import CashierIcon from '../components/icons/cashier-stroke-rounded'
import { PageHeader } from '../components/PageHeader'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { useTelegram } from '../hooks/useTelegram'
import { fetchPanelOptions, importExistingPanel, previewExistingPanel } from '../lib/panelApi'
import type { PanelCredentialsState } from '../types/panel'
import '../styles/shop-rise.css'
import './PanelFlow.css'

type ImportKind = 'usage' | 'reseller'
type ImportStage = 'idle' | 'finding' | 'reading' | 'saving'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function PanelImportPage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [kind, setKind] = useState<ImportKind>('usage')
  const [hasUsage, setHasUsage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<ImportStage>('idle')
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  useEffect(() => {
    void fetchPanelOptions()
      .then((options) => {
        const alreadyHasUsage = Boolean(options.subscriptions.usage)
        setHasUsage(alreadyHasUsage)
        if (alreadyHasUsage) setKind('reseller')
      })
      .catch(() => {})
  }, [])

  const canSubmit =
    username.trim().length >= 2 &&
    password.length > 0 &&
    !(kind === 'usage' && hasUsage) &&
    !busy

  const handleSubmit = async (event?: FormEvent) => {
    if (event) event.preventDefault()
    if (!canSubmit) return

    setBusy(true)
    setNotification((prev) => ({ ...prev, show: false }))
    setStage('finding')
    try {
      const payload = {
        username: username.trim(),
        password,
        kind,
      }
      await previewExistingPanel(payload)
      setStage('reading')
      await sleep(650)
      setStage('saving')
      const result = await importExistingPanel(payload)
      haptic('light')
      navigate('/panel/success', {
        state: {
          credentials: result.credentials,
          kind: 'import',
        } satisfies PanelCredentialsState,
      })
    } catch (err) {
      haptic('light')
      setNotification({
        show: true,
        message: err instanceof Error ? err.message : 'ثبت پنل ناموفق بود',
        type: 'error',
      })
      setStage('idle')
      setBusy(false)
    }
  }

  return (
    <div className="panel-flow">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="انتقال پنل موجود" onBack={() => navigate('/panel')} />
      </div>

      <form
        className="panel-flow__content shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="panel-flow__steps">
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-active" />
          <span className="panel-flow__step" />
        </div>

        <div className="panel-flow__summary">
          <h2 className="panel-flow__summary-title">ثبت پنل از پیش تهیه‌شده</h2>
          <p className="panel-flow__summary-desc">
            نوع پنل را مشخص کنید و اطلاعات ورود ادمین را وارد نمایید. حجم پرداخت‌شده از ظرفیت فعلی ادمین در سرور خوانده می‌شود؛ مصرف بیشتر از آن مقدار از کیف پول کسر خواهد شد.
          </p>
        </div>

        <div className="panel-flow__segment" role="tablist" aria-label="نوع پنل">
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'usage'}
            className={`panel-flow__segment-btn${kind === 'usage' ? ' is-active' : ''}`}
            disabled={hasUsage}
            onClick={() => {
              haptic('light')
              setKind('usage')
            }}
          >
            <CashierIcon width={16} height={16} color="currentColor" />
            پنل مصرفی
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'reseller'}
            className={`panel-flow__segment-btn${kind === 'reseller' ? ' is-active' : ''}`}
            onClick={() => {
              haptic('light')
              setKind('reseller')
            }}
          >
            <Agreement02Icon width={16} height={16} color="currentColor" />
            پنل ریسلری
          </button>
        </div>

        {hasUsage ? (
          <p className="panel-flow__hint" style={{ marginInline: 'var(--page-padding-x)' }}>
            پنل مصرفی شخصی شما قبلاً ثبت شده است
          </p>
        ) : null}

        <div className="panel-flow__fields-row">
          <div className="panel-flow__field">
            <div className="panel-flow__label-row">
              <span className="panel-flow__label">نام کاربری</span>
            </div>
            <div className="panel-flow__input-wrap">
              <input
                className="panel-flow__input"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                }}
                placeholder="username"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                dir="ltr"
              />
            </div>
          </div>

          <div className="panel-flow__field">
            <div className="panel-flow__label-row">
              <span className="panel-flow__label">رمز عبور</span>
            </div>
            <div className="panel-flow__input-wrap">
              <input
                className="panel-flow__input"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </form>

      <footer className="panel-flow__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        <button
          type="button"
          className="panel-flow__continue"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {stage === 'finding'
            ? 'در حال دریافت اطلاعات'
            : stage === 'reading'
              ? 'تشخیص حجم و تعداد کاربر'
              : stage === 'saving'
                ? 'در حال ثبت'
                : 'ثبت و انتقال مدیریت'}
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
