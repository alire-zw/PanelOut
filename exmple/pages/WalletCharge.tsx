import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NumeralKeypad } from '../components/NumeralKeypad'
import { PageHeader } from '../components/PageHeader'
import {
  appendAmountDigit,
  formatAmountFa,
  getChargeAmountError,
  isChargeAmountValid,
  parseAmountDigits,
  removeLastAmountDigit,
} from '../lib/amount'
import { isTelegramWebApp } from '../lib/api'
import { useTelegram } from '../hooks/useTelegram'
import type { WalletChargeAmountState } from '../types/wallet'
import '../styles/shop-rise.css'
import './WalletCharge.css'

export function WalletChargePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const [amountDigits, setAmountDigits] = useState('')

  useEffect(() => {
    const restoredAmount = (location.state as WalletChargeAmountState | null)?.amount
    if (restoredAmount && restoredAmount > 0) {
      setAmountDigits(String(restoredAmount))
    }
  }, [location.key, location.state])

  const amountToman = useMemo(() => parseAmountDigits(amountDigits), [amountDigits])
  const amountDisplay = useMemo(() => formatAmountFa(amountDigits), [amountDigits])
  const amountError = useMemo(
    () => getChargeAmountError(amountToman, Boolean(amountDigits)),
    [amountDigits, amountToman],
  )
  const canContinue = isChargeAmountValid(amountToman)

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
    navigate('/wallet/charge/payment', { state: { amount: amountToman } })
  }

  return (
    <div className="wallet-charge">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="شارژ حساب" onBack={handleBack} />
      </div>

      <div className="wallet-charge__body">
        <section
          className="wallet-charge__amount shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="مبلغ شارژ"
        >
          <p className="wallet-charge__label">مبلغ شارژ</p>
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
