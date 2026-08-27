import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import SuccessIcon from '../components/icons/SuccessIcon'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchTransferOrder } from '../lib/transfers'
import {
  formatTransferRecipientHandle,
  formatTransferRecipientName,
  formatTransferRecipientTelegramId,
  getTransferRecipientInitials,
} from '../lib/transferRecipients'
import type { TransferResult } from '../types/transfer'
import '../styles/shop-rise.css'
import './WalletPaymentResult.css'
import './WalletTransferRecipient.css'

interface TransferSuccessState {
  transfer?: TransferResult
}

function formatToman(value: string | number): string {
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

export function WalletTransferSuccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const transferId = searchParams.get('transferId')
  const { refetch } = useUser()
  const { haptic } = useTelegram()

  const initialTransfer = (location.state as TransferSuccessState | null)?.transfer ?? null

  const [transfer, setTransfer] = useState<TransferResult | null>(initialTransfer)
  const [isLoading, setIsLoading] = useState(Boolean(transferId && !initialTransfer))

  const handleBack = useCallback(() => {
    navigate('/wallet', { replace: true })
  }, [navigate])

  useEffect(() => {
    haptic('medium')
  }, [haptic])

  useEffect(() => {
    void refetch({ silent: true })
  }, [refetch])

  useEffect(() => {
    if (initialTransfer || !transferId) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    void fetchTransferOrder(transferId)
      .then((result) => {
        if (!cancelled) {
          setTransfer({ ...result, balanceAfter: '0' })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTransfer(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [initialTransfer, transferId])

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

  const recipient = transfer?.recipient ?? null
  const handle = recipient ? formatTransferRecipientHandle(recipient) : null

  return (
    <div className="wallet-payment-result wallet-payment-result--success">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="انتقال موفق" onBack={handleBack} />
      </div>

      <div className="wallet-payment-result__content">
        <section
          className="wallet-payment-result__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <div className="wallet-payment-result__icon wallet-payment-result__icon--success">
            <SuccessIcon width={34} height={34} />
          </div>
          <h2 className="wallet-payment-result__title">انتقال با موفقیت انجام شد</h2>
          <p className="wallet-payment-result__subtitle">
            مبلغ انتقال از کیف پول شما کسر و به گیرنده واریز شد.
          </p>
        </section>

        {recipient ? (
          <div
            className="wallet-payment-result__recipient-section shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
          >
            <h2 className="wallet-payment-result__recipient-label">گیرنده</h2>
            <div className="transfer-recipient__item transfer-recipient__item--display" aria-label="گیرنده">
              <span className="transfer-recipient__avatar">
                {getTransferRecipientInitials(recipient)}
              </span>
              <span className="transfer-recipient__info">
                <span className="transfer-recipient__name">
                  {formatTransferRecipientName(recipient)}
                </span>
                {handle ? (
                  <span className="transfer-recipient__handle" dir="ltr">
                    {handle}
                  </span>
                ) : null}
              </span>
              <span className="transfer-recipient__telegram-id">
                <span className="transfer-recipient__telegram-id-label">شناسه عددی</span>
                <span className="transfer-recipient__telegram-id-value">
                  {formatTransferRecipientTelegramId(recipient.telegramId)}
                </span>
              </span>
            </div>
          </div>
        ) : null}

        <section
          className="wallet-payment-result__card shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="جزئیات انتقال"
        >
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">مبلغ انتقال</span>
            {isLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value wallet-payment-result__row-value--amount">
                <span className="wallet-payment-result__row-unit">تومان</span>
                <span>{transfer ? formatToman(transfer.amountToman) : '—'}</span>
              </span>
            )}
          </div>
          <div className="wallet-payment-result__row">
            <span className="wallet-payment-result__row-label">شماره تراکنش</span>
            {isLoading ? (
              <span className="wallet-payment-result__skeleton" />
            ) : (
              <span className="wallet-payment-result__row-value">
                {transfer?.transferId ?? transferId ?? '—'}
              </span>
            )}
          </div>
        </section>
      </div>

      <footer
        className="wallet-payment-result__footer shop-rise"
        style={{ '--rise-index': 4 } as CSSProperties}
      >
        <button
          type="button"
          className="wallet-payment-result__primary"
          onClick={() => {
            haptic('light')
            navigate('/wallet/transfer', { replace: true })
          }}
        >
          انتقال جدید
        </button>
        <button
          type="button"
          className="wallet-payment-result__secondary"
          onClick={() => {
            haptic('light')
            handleBack()
          }}
        >
          بازگشت به کیف پول
        </button>
      </footer>
    </div>
  )
}
