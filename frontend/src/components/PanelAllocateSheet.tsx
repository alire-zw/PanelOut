import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTelegram } from '../hooks/useTelegram'
import { lockAppScroll, unlockAppScroll } from '../lib/scrollLock'
import {
  appendAmountDigit,
  formatAmountFa,
  parseAmountDigits,
  removeLastAmountDigit,
} from '../lib/amount'
import { NumeralKeypad } from './NumeralKeypad'
import MoneyAdd02Icon from './icons/money-add-02-stroke-rounded'
import MoneyRemove02Icon from './icons/money-remove-02-stroke-rounded'
import type { PanelSubscription } from '../lib/panelApi'
import './PanelAllocateSheet.css'

type PanelAllocateSheetProps = {
  isOpen: boolean
  panel: PanelSubscription | null
  userBalance: number
  onClose: () => void
  onConfirm: (
    panel: PanelSubscription,
    amount: number,
    action: 'increase' | 'decrease',
  ) => Promise<void>
  isBusy?: boolean
}

const PRESET_AMOUNTS = [50_000, 100_000, 250_000, 500_000]

function formatFaNumber(value: number) {
  return Math.trunc(Number(value) || 0).toLocaleString('fa-IR')
}

export function PanelAllocateSheet({
  isOpen,
  panel: panelProp,
  userBalance,
  onClose,
  onConfirm,
  isBusy = false,
}: PanelAllocateSheetProps) {
  const { haptic } = useTelegram()
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [heldPanel, setHeldPanel] = useState(panelProp)
  const [action, setAction] = useState<'increase' | 'decrease'>('increase')
  const [amountDigits, setAmountDigits] = useState('')

  useEffect(() => {
    if (panelProp) setHeldPanel(panelProp)
  }, [panelProp])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setAmountDigits('')
      setAction('increase')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true))
      })
      return
    }

    setIsVisible(false)
    const timer = window.setTimeout(() => setShouldRender(false), 480)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      unlockAppScroll()
      return
    }

    lockAppScroll()
    return () => unlockAppScroll()
  }, [isOpen])

  if (!shouldRender || !heldPanel) return null

  const panel = heldPanel
  const panelBalance = panel.walletBalance ?? 0
  const amountToman = parseAmountDigits(amountDigits)
  const maxAvailable = action === 'increase' ? userBalance : panelBalance

  let validationError: string | null = null
  if (amountDigits.length > 0) {
    if (amountToman < 1000) {
      validationError = 'حداقل مبلغ ۱٬۰۰۰ تومان است'
    } else if (amountToman > maxAvailable) {
      validationError =
        action === 'increase'
          ? 'مبلغ بیشتر از موجودی کیف پول اصلی است'
          : 'مبلغ بیشتر از موجودی کیف پنل است'
    }
  }

  const canSubmit = amountToman >= 1000 && amountToman <= maxAvailable && !isBusy

  const handlePreset = (val: number) => {
    haptic('light')
    setAmountDigits(String(val))
  }

  const handleSetMax = () => {
    haptic('light')
    if (maxAvailable >= 1000) {
      setAmountDigits(String(Math.trunc(maxAvailable)))
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    haptic('medium')
    await onConfirm(panel, amountToman, action)
  }

  return createPortal(
    <>
      <div
        className={`panel-allocate__backdrop${
          isVisible ? ' panel-allocate__backdrop--visible' : ''
        }`}
        onClick={() => {
          if (!isBusy) onClose()
        }}
        role="presentation"
      />

      <div
        className={`panel-allocate__panel${
          isVisible ? ' panel-allocate__panel--visible' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="مدیریت موجودی پنل"
      >
        <div className="panel-allocate__header">
          <div className="panel-allocate__handle" aria-hidden />
          <div className="panel-allocate__title-row">
            <h3 className="panel-allocate__title">مدیریت موجودی پنل ریسلری</h3>
            <span className="panel-allocate__badge" dir="ltr">
              {panel.clientUsername}
            </span>
          </div>
        </div>

        <div className="panel-allocate__content">
          {/* Action switcher */}
          <div className="panel-allocate__tabs">
            <button
              type="button"
              className={`panel-allocate__tab panel-allocate__tab--increase${
                action === 'increase' ? ' panel-allocate__tab--active' : ''
              }`}
              onClick={() => {
                haptic('light')
                setAction('increase')
              }}
            >
              <MoneyAdd02Icon width={16} height={16} />
              <span>افزایش موجودی</span>
            </button>
            <button
              type="button"
              className={`panel-allocate__tab panel-allocate__tab--decrease${
                action === 'decrease' ? ' panel-allocate__tab--active' : ''
              }`}
              onClick={() => {
                haptic('light')
                setAction('decrease')
              }}
            >
              <MoneyRemove02Icon width={16} height={16} />
              <span>کسر موجودی</span>
            </button>
          </div>

          {/* Balances summary */}
          <div className="panel-allocate__balances">
            <div
              className={`panel-allocate__balance-box${
                action === 'decrease' ? ' panel-allocate__balance-box--target' : ''
              }`}
            >
              <span className="panel-allocate__balance-label">موجودی کیف اصلی</span>
              <span className="panel-allocate__balance-val">
                {formatFaNumber(userBalance)} تومان
              </span>
            </div>
            <div
              className={`panel-allocate__balance-box${
                action === 'increase' ? ' panel-allocate__balance-box--target' : ''
              }`}
            >
              <span className="panel-allocate__balance-label">موجودی کیف پنل</span>
              <span className="panel-allocate__balance-val">
                {formatFaNumber(panelBalance)} تومان
              </span>
            </div>
          </div>

          {/* Amount Card */}
          <div className="panel-allocate__amount-card">
            <span className="panel-allocate__amount-label">
              {action === 'increase'
                ? 'مبلغ انتقال به پنل'
                : 'مبلغ برگشت به کیف اصلی'}
            </span>
            <div className="panel-allocate__amount-value-row">
              <span
                className={`panel-allocate__amount-digits${
                  amountDigits ? '' : ' panel-allocate__amount-digits--empty'
                }`}
              >
                {amountDigits ? formatAmountFa(amountDigits) : '۰'}
              </span>
              <span className="panel-allocate__amount-currency">تومان</span>
            </div>
            {validationError ? (
              <p className="panel-allocate__error" role="alert">
                {validationError}
              </p>
            ) : null}
          </div>

          {/* Quick chips */}
          <div className="panel-allocate__chips">
            {PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                className="panel-allocate__chip"
                onClick={() => handlePreset(val)}
              >
                {formatFaNumber(val)}
              </button>
            ))}
            {maxAvailable >= 1000 ? (
              <button
                type="button"
                className="panel-allocate__chip panel-allocate__chip--max"
                onClick={handleSetMax}
              >
                کل موجودی
              </button>
            ) : null}
          </div>

          {/* Numeral Keypad */}
          <div className="panel-allocate__keypad">
            <NumeralKeypad
              onDigit={(digit) => {
                haptic('light')
                setAmountDigits((curr) => appendAmountDigit(curr, digit))
              }}
              onBackspace={() => {
                haptic('light')
                setAmountDigits((curr) => removeLastAmountDigit(curr))
              }}
            />
          </div>

          {/* Actions */}
          <div className="panel-allocate__actions">
            <button
              type="button"
              className={`panel-allocate__btn panel-allocate__btn--submit ${
                action === 'increase'
                  ? 'panel-allocate__btn--increase'
                  : 'panel-allocate__btn--decrease'
              }`}
              disabled={!canSubmit || isBusy}
              onClick={() => void handleSubmit()}
            >
              {isBusy
                ? 'در حال انجام…'
                : action === 'increase'
                  ? 'تأیید افزایش موجودی پنل'
                  : 'تأیید کسر و انتقال به کیف اصلی'}
            </button>
            <button
              type="button"
              className="panel-allocate__btn panel-allocate__btn--cancel panel-allocate__btn--ghost"
              disabled={isBusy}
              onClick={onClose}
            >
              انصراف
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
