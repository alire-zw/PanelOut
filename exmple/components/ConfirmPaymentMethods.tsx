import BankCardIcon from './icons/BankCardIcon'
import Money03Icon from './icons/money-03-stroke-rounded'
import { resolveWalletGatewaySplit } from '../lib/walletGatewaySplit'
import { useEffect, type CSSProperties } from 'react'
import './ConfirmPaymentMethods.css'

export type ConfirmPaymentMethodId = 'wallet' | 'zibal'

type ConfirmPaymentMethodsProps = {
  method: ConfirmPaymentMethodId
  onMethodChange: (method: ConfirmPaymentMethodId) => void
  balance: number
  toman: number
  useWalletBalance: boolean
  onUseWalletBalanceChange: (value: boolean) => void
  walletInsufficient: boolean
  onHaptic?: () => void
  /** Product brand color for selected state / icons (overrides page --accent). */
  accent?: string
}

const PAYMENT_METHODS: Array<{
  id: ConfirmPaymentMethodId
  title: string
  subtitle: string
  Icon: typeof BankCardIcon
}> = [
  {
    id: 'wallet',
    title: 'موجودی کیف پول',
    subtitle: 'پرداخت آنی از موجودی حساب',
    Icon: Money03Icon,
  },
  {
    id: 'zibal',
    title: 'درگاه آنلاین زیبال',
    subtitle: 'پرداخت از طریق درگاه بانکی',
    Icon: BankCardIcon,
  },
]

export function ConfirmPaymentMethods({
  method,
  onMethodChange,
  balance,
  toman,
  useWalletBalance,
  onUseWalletBalanceChange,
  walletInsufficient,
  onHaptic,
  accent,
}: ConfirmPaymentMethodsProps) {
  const canPayFullyWithWallet = balance > 0 && balance >= toman
  /** Only for partial cover: some balance, but not enough for the full order. */
  const canUsePartialWallet = balance > 0 && balance < toman
  const effectiveUseWallet = canUsePartialWallet && useWalletBalance
  const paymentSplit = resolveWalletGatewaySplit(toman, balance, effectiveUseWallet)
  const payableToman = effectiveUseWallet ? paymentSplit.gatewayAmount : toman
  const walletDisabled = !canPayFullyWithWallet

  useEffect(() => {
    if (!canPayFullyWithWallet && method === 'wallet') {
      onMethodChange('zibal')
      onUseWalletBalanceChange(false)
    }
    // Parent passes inline handlers; only react to ability/method.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [canPayFullyWithWallet, method])

  return (
    <div
      className="confirm-pay__methods"
      role="radiogroup"
      aria-label="روش پرداخت"
      style={
        accent
          ? ({
              '--accent': accent,
              accentColor: accent,
            } as CSSProperties)
          : undefined
      }
    >
      {PAYMENT_METHODS.map((option) => {
        const isSelected = method === option.id
        const Icon = option.Icon
        const isWalletOption = option.id === 'wallet'
        const showWalletWarning =
          isWalletOption && !walletDisabled && walletInsufficient
        const isZibalExpanded = option.id === 'zibal' && isSelected && canUsePartialWallet

        return (
          <div
            key={option.id}
            className={`confirm-pay__method${
              isSelected ? ' confirm-pay__method--selected' : ''
            }${showWalletWarning ? ' confirm-pay__method--warning' : ''}${
              isWalletOption && walletDisabled ? ' confirm-pay__method--disabled' : ''
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isWalletOption && walletDisabled}
              disabled={isWalletOption && walletDisabled}
              className="confirm-pay__method-main"
              onClick={() => {
                if (isWalletOption && walletDisabled) return
                onHaptic?.()
                onMethodChange(option.id)
                if (option.id !== 'zibal' || !canUsePartialWallet) {
                  onUseWalletBalanceChange(false)
                }
              }}
            >
              <span className="confirm-pay__method-icon">
                <Icon width={18} height={18} />
              </span>
              <span className="confirm-pay__method-text">
                <span className="confirm-pay__method-title">{option.title}</span>
                <span className="confirm-pay__method-subtitle">
                  {isWalletOption && walletDisabled
                    ? balance <= 0
                      ? 'موجودی ندارید'
                      : `موجودی: ${balance.toLocaleString('fa-IR')} تومان`
                    : showWalletWarning
                      ? `موجودی: ${balance.toLocaleString('fa-IR')} تومان`
                      : option.subtitle}
                </span>
              </span>
            </button>

            {isZibalExpanded ? (
              <div className="confirm-pay__method-details">
                <label className="confirm-pay__wallet-toggle">
                  <input
                    type="checkbox"
                    checked={useWalletBalance}
                    onChange={(event) => {
                      onHaptic?.()
                      onUseWalletBalanceChange(event.target.checked)
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span className="confirm-pay__wallet-toggle-text">
                    <span className="confirm-pay__wallet-toggle-title">
                      استفاده از موجودی کیف پول
                    </span>
                    <span className="confirm-pay__wallet-toggle-subtitle">
                      موجودی: {balance.toLocaleString('fa-IR')} تومان
                    </span>
                  </span>
                </label>

                <div
                  className={`confirm-pay__pay-stats${
                    effectiveUseWallet && paymentSplit.walletAmount > 0
                      ? ''
                      : ' confirm-pay__pay-stats--two'
                  }`}
                  aria-label="جزئیات پرداخت"
                >
                  <span className="confirm-pay__pay-stat">
                    <span className="confirm-pay__pay-stat-label">مبلغ سفارش</span>
                    <span className="confirm-pay__pay-stat-value">
                      {toman.toLocaleString('fa-IR')}
                      <span className="confirm-pay__pay-stat-unit">تومان</span>
                    </span>
                  </span>
                  {effectiveUseWallet && paymentSplit.walletAmount > 0 ? (
                    <span className="confirm-pay__pay-stat">
                      <span className="confirm-pay__pay-stat-label">از کیف پول</span>
                      <span className="confirm-pay__pay-stat-value">
                        {paymentSplit.walletAmount.toLocaleString('fa-IR')}
                        <span className="confirm-pay__pay-stat-unit">تومان</span>
                      </span>
                    </span>
                  ) : null}
                  <span className="confirm-pay__pay-stat confirm-pay__pay-stat--gateway">
                    <span className="confirm-pay__pay-stat-label">پرداخت درگاه</span>
                    <span className="confirm-pay__pay-stat-value">
                      {payableToman.toLocaleString('fa-IR')}
                      <span className="confirm-pay__pay-stat-unit">تومان</span>
                    </span>
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function getConfirmPayableToman(
  method: ConfirmPaymentMethodId,
  toman: number,
  balance: number,
  useWalletBalance: boolean,
): number {
  if (method !== 'zibal' || !useWalletBalance || balance <= 0 || balance >= toman) {
    return toman
  }
  return resolveWalletGatewaySplit(toman, balance, true).gatewayAmount
}

/** Default method: wallet only when balance covers the full order. */
export function getDefaultConfirmPaymentMethod(
  balance: number,
  toman = 0,
): ConfirmPaymentMethodId {
  if (toman > 0 && balance >= toman) return 'wallet'
  return 'zibal'
}

/** Partial wallet toward gateway is only valid when balance covers some, but not all, of the order. */
export function canUsePartialWalletTowardGateway(balance: number, toman: number): boolean {
  return balance > 0 && balance < toman
}
