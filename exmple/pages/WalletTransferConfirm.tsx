import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { formatAmountFa, isTransferAmountValid } from '../lib/amount'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import { executeTransfer } from '../lib/transfers'
import {
  formatTransferRecipientHandle,
  formatTransferRecipientName,
  formatTransferRecipientTelegramId,
  getTransferRecipientInitials,
} from '../lib/transferRecipients'
import type { WalletTransferConfirmState } from '../types/transfer'
import '../styles/shop-rise.css'
import './WalletTransferConfirm.css'
import './WalletTransferRecipient.css'

function formatToman(value: number): string {
  return value.toLocaleString('fa-IR')
}

export function WalletTransferConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refetch } = useUser()
  const { haptic } = useTelegram()
  const confirmState = location.state as WalletTransferConfirmState | null
  const amount = confirmState?.amount ?? 0
  const recipient = confirmState?.recipient ?? null

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'error',
  })

  const balance = user ? balanceToToman(user.balance) : 0
  const balanceAfter = useMemo(() => Math.max(0, balance - amount), [amount, balance])

  const handleBack = useCallback(() => {
    navigate('/wallet/transfer/recipient', {
      state: { amount, recipient: recipient ?? undefined },
      replace: true,
    })
  }, [amount, navigate, recipient])

  useEffect(() => {
    if (isTransferAmountValid(amount, balance) && recipient) return
    navigate('/wallet/transfer', { replace: true })
  }, [amount, balance, navigate, recipient])

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

  if (!isTransferAmountValid(amount, balance) || !recipient) {
    return null
  }

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'error',
  ) => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    haptic('light')
    setIsSubmitting(true)

    try {
      const result = await executeTransfer(recipient.telegramId, amount)
      await refetch({ silent: true })
      navigate(
        `/wallet/transfer/success?transferId=${encodeURIComponent(result.transferId)}`,
        {
          replace: true,
          state: { transfer: result },
        },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطا در انجام انتقال'
      showNotification(message, 'error')

      if (message.includes('موجودی') || message.includes('balance')) {
        void refetch({ silent: true })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handle = formatTransferRecipientHandle(recipient)

  return (
    <div className="wallet-transfer-confirm">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="تأیید انتقال" onBack={handleBack} />
      </div>

      <div className="wallet-transfer-confirm__content">
        <h2
          className="wallet-transfer-confirm__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          گیرنده
        </h2>

        <div
          className="transfer-recipient__item transfer-recipient__item--display shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="گیرنده"
        >
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

        <div
          className="wallet-transfer-confirm__amount-card shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          aria-label="مبلغ انتقال"
        >
          <span className="wallet-transfer-confirm__amount-label">مبلغ انتقال</span>
          <div className="wallet-transfer-confirm__amount-row">
            <span className="wallet-transfer-confirm__amount-unit">تومان</span>
            <span className="wallet-transfer-confirm__amount-value">
              {formatAmountFa(String(amount))}
            </span>
          </div>
        </div>

        <div
          className="wallet-transfer-confirm__summary shop-rise"
          style={{ '--rise-index': 4 } as CSSProperties}
          aria-label="خلاصه موجودی"
        >
          <div className="wallet-transfer-confirm__row">
            <span className="wallet-transfer-confirm__row-label">موجودی فعلی</span>
            <span className="wallet-transfer-confirm__row-value">
              {formatToman(balance)} تومان
            </span>
          </div>
          <div className="wallet-transfer-confirm__row">
            <span className="wallet-transfer-confirm__row-label">موجودی پس از انتقال</span>
            <span className="wallet-transfer-confirm__row-value wallet-transfer-confirm__row-value--accent">
              {formatToman(balanceAfter)} تومان
            </span>
          </div>
        </div>

        <p
          className="wallet-transfer-confirm__notice shop-rise"
          style={{ '--rise-index': 5 } as CSSProperties}
        >
          پس از تأیید، مبلغ به‌صورت آنی از کیف پول شما کسر و به گیرنده واریز می‌شود. این عملیات
          قابل بازگشت نیست.
        </p>
      </div>

      <footer
        className="wallet-transfer-confirm__footer shop-rise"
        style={{ '--rise-index': 6 } as CSSProperties}
      >
        <button
          type="button"
          className="wallet-transfer-confirm__submit"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? 'در حال انتقال...' : 'تأیید و انتقال'}
        </button>
      </footer>
    </div>
  )
}
