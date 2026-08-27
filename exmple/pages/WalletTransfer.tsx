import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NumeralKeypad } from '../components/NumeralKeypad'
import { PageHeader } from '../components/PageHeader'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import {
  appendAmountDigit,
  formatAmountFa,
  getTransferAmountError,
  isTransferAmountValid,
  parseAmountDigits,
  removeLastAmountDigit,
} from '../lib/amount'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import type { WalletTransferAmountState } from '../types/wallet'
import '../styles/shop-rise.css'
import './WalletCharge.css'

export function WalletTransferPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useUser()
  const { haptic } = useTelegram()
  const [amountDigits, setAmountDigits] = useState('')

  const balance = user ? balanceToToman(user.balance) : 0

  useEffect(() => {
    const restoredAmount = (location.state as WalletTransferAmountState | null)?.amount
    if (restoredAmount && restoredAmount > 0) {
      setAmountDigits(String(restoredAmount))
    }
  }, [location.key, location.state])

  const amountToman = useMemo(() => parseAmountDigits(amountDigits), [amountDigits])
  const amountDisplay = useMemo(() => formatAmountFa(amountDigits), [amountDigits])
  const amountError = useMemo(
    () => getTransferAmountError(amountToman, Boolean(amountDigits), balance),
    [amountDigits, amountToman, balance],
  )
  const canContinue = isTransferAmountValid(amountToman, balance)

  const handleBack = useCallback(() => navigate(-1), [navigate])

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

  const handleContinue = () => {
    if (!canContinue) return
    haptic('light')
    navigate('/wallet/transfer/recipient', { state: { amount: amountToman } })
  }

  return (
    <div className="wallet-charge">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="انتقال موجودی" onBack={handleBack} />
      </div>

      <div className="wallet-charge__body">
        <section
          className="wallet-charge__amount shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="مبلغ انتقال"
        >
          <p className="wallet-charge__label">مبلغ انتقال</p>
          <div className="wallet-charge__value-row">
            <span className="wallet-charge__unit">تومان</span>
            <span
              className={`wallet-charge__value${
                amountDigits ? '' : ' wallet-charge__value--placeholder'
              }`}
            >
              {amountDisplay}
            </span>
          </div>
          {amountError ? (
            <p className="wallet-charge__error" role="alert">
              {amountError}
            </p>
          ) : null}
        </section>

        <div
          className="wallet-charge__keypad shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
        >
          <NumeralKeypad
            onDigit={(digit) => setAmountDigits((current) => appendAmountDigit(current, digit))}
            onBackspace={() => setAmountDigits((current) => removeLastAmountDigit(current))}
          />
        </div>
      </div>

      <footer
        className="wallet-charge__footer shop-rise"
        style={{ '--rise-index': 3 } as CSSProperties}
      >
        <button
          type="button"
          className="wallet-charge__continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
