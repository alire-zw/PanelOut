import { useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { usePanelUsernameCheck } from '../hooks/usePanelUsernameCheck'
import { useTelegram } from '../hooks/useTelegram'
import { activatePanelReseller } from '../lib/panelApi'
import type { PanelCredentialsState } from '../types/panel'
import '../styles/shop-rise.css'
import './PanelFlow.css'

export function PanelResellerUsernamePage() {
  useEnsureUser()
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const checkState = usePanelUsernameCheck(username)

  const handleSubmit = async (event?: FormEvent) => {
    if (event) event.preventDefault()
    if (!checkState.isAvailable) return

    setBusy(true)
    setError(null)
    try {
      const result = await activatePanelReseller(username.trim().toLowerCase())
      haptic('light')
      navigate('/panel/success', {
        state: {
          credentials: result.credentials,
          kind: 'reseller',
        } satisfies PanelCredentialsState,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ساخت پنل ریسلری')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel-flow">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="پنل ریسلری" onBack={() => navigate('/panel')} />
      </div>

      <form
        className="panel-flow__content shop-rise"
        style={{ '--rise-index': 1 } as CSSProperties}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="panel-flow__steps">
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-done" />
          <span className="panel-flow__step is-active" />
        </div>

        <div className="panel-flow__summary">
          <h2 className="panel-flow__summary-title">نام کاربری پنل ریسلری</h2>
          <p className="panel-flow__summary-desc">
            این پنل برای فروش به دیگران است. مصرف آن از کیف پول اختصاصی همین پنل کسر می‌شود، نه از کیف پول اصلی.
          </p>
        </div>

        <div className="panel-flow__info-box">
          <p className="panel-flow__info-box-title">کیف پول جدا</p>
          <p className="panel-flow__info-box-desc">
            بعد از ساخت، از داشبورد → پنل‌های من می‌توانید موجودی را از کیف پول اصلی به این پنل تخصیص دهید.
          </p>
        </div>

        <div className="panel-flow__field">
          <div className="panel-flow__label-row">
            <span className="panel-flow__label">نام کاربری ادمین</span>
            {checkState.text ? (
              <span
                className={`panel-flow__label-status panel-flow__label-status--${
                  checkState.status === 'available'
                    ? 'success'
                    : checkState.status === 'checking'
                      ? 'checking'
                      : 'error'
                }`}
              >
                {checkState.text}
              </span>
            ) : null}
          </div>

          <div
            className={`panel-flow__input-wrap ${
              checkState.status === 'available'
                ? 'panel-flow__input-wrap--valid'
                : checkState.status === 'unavailable' || checkState.status === 'invalid'
                  ? 'panel-flow__input-wrap--invalid'
                  : ''
            }`}
          >
            <input
              className="panel-flow__input"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value.toLowerCase())
                setError(null)
              }}
              placeholder="reseller01"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              dir="ltr"
            />
          </div>
          <p className="panel-flow__hint">۳ تا ۳۲ کاراکتر — فقط حروف کوچک انگلیسی (a-z)</p>
        </div>

        {error ? <p className="panel-flow__error">{error}</p> : null}
      </form>

      <footer className="panel-flow__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        <button
          type="button"
          className="panel-flow__continue"
          disabled={busy || !checkState.isAvailable}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'در حال ساخت…' : 'ساخت پنل ریسلری'}
        </button>
      </footer>
    </div>
  )
}
