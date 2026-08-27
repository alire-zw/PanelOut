import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import Money03Icon from '../components/icons/money-03-stroke-rounded'
import MoneyAdd02Icon from '../components/icons/money-add-02-stroke-rounded'
import MoneyPending02Icon from '../components/icons/money-pending-02-stroke-rounded'
import MoneyReceive02Icon from '../components/icons/money-receive-02-stroke-rounded'
import MoneyReceiveFlow02Icon from '../components/icons/money-receive-flow-02-stroke-rounded'
import MoneyRemove02Icon from '../components/icons/money-remove-02-stroke-rounded'
import MoneySend02Icon from '../components/icons/money-send-02-stroke-rounded'
import MoneySendFlow02Icon from '../components/icons/money-send-flow-02-stroke-rounded'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { fetchPaymentOrder, openPaymentUrl } from '../lib/payments'
import {
  fetchWalletTransactions,
  readLocalWalletTransactions,
  syncWalletTransactions,
  writeLocalWalletTransactions,
  type WalletTransactionsPayload,
} from '../lib/walletTransactions'
import { balanceToToman, isTelegramWebApp } from '../lib/api'
import type { WalletTransaction, WalletTransactionStatus } from '../types/wallet'
import '../styles/shop-rise.css'
import './Wallet.css'

function formatTransactionAmount(
  amount: number,
  status: WalletTransactionStatus,
): string {
  const value = Math.abs(amount)

  if (status === 'failed') {
    return value.toLocaleString('fa-IR')
  }

  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${prefix}${value.toLocaleString('fa-IR')}`
}

function TransactionIcon({ transaction }: { transaction: WalletTransaction }) {
  const iconProps = { width: 16, height: 16 }

  if (transaction.status === 'pending') {
    return <MoneyPending02Icon {...iconProps} />
  }

  if (transaction.status === 'failed') {
    return <MoneyRemove02Icon {...iconProps} />
  }

  if (transaction.type === 'transfer') {
    return transaction.transferDirection === 'in' ? (
      <MoneyReceiveFlow02Icon {...iconProps} />
    ) : (
      <MoneySendFlow02Icon {...iconProps} />
    )
  }

  if (transaction.paymentMethod === 'tron') {
    return <DepositCryptoIcon {...iconProps} />
  }

  if (transaction.type === 'purchase') {
    return <MoneySendFlow02Icon {...iconProps} />
  }

  if (transaction.type === 'deposit' || transaction.type === 'refund') {
    return <MoneyReceive02Icon {...iconProps} />
  }

  return <Money03Icon {...iconProps} />
}

function getTransactionAmountClass(transaction: WalletTransaction): string {
  if (transaction.status === 'pending') {
    return 'wallet__transaction-amount--pending'
  }

  if (transaction.status === 'failed') {
    return 'wallet__transaction-amount--failed'
  }

  if (transaction.type === 'transfer') {
    return transaction.amount > 0
      ? 'wallet__transaction-amount--transfer-in'
      : 'wallet__transaction-amount--transfer-out'
  }

  if (transaction.amount < 0) {
    return 'wallet__transaction-amount--transfer-out'
  }

  return 'wallet__transaction-amount--positive'
}

function getTransactionIconClass(transaction: WalletTransaction): string {
  if (transaction.status === 'pending') {
    return 'wallet__transaction-icon wallet__transaction-icon--pending'
  }

  if (transaction.status === 'failed') {
    return 'wallet__transaction-icon wallet__transaction-icon--failed'
  }

  if (transaction.type === 'transfer') {
    return transaction.transferDirection === 'in'
      ? 'wallet__transaction-icon wallet__transaction-icon--transfer-in'
      : 'wallet__transaction-icon wallet__transaction-icon--transfer-out'
  }

  if (transaction.type === 'purchase' || transaction.amount < 0) {
    return 'wallet__transaction-icon wallet__transaction-icon--transfer-out'
  }

  if (transaction.type === 'deposit' || transaction.type === 'refund') {
    return 'wallet__transaction-icon wallet__transaction-icon--deposit'
  }

  return 'wallet__transaction-icon'
}

function TransactionRow({
  transaction,
  onClick,
}: {
  transaction: WalletTransaction
  onClick?: (transaction: WalletTransaction) => void
}) {
  const isClickable = Boolean(onClick)
  const amountClass = getTransactionAmountClass(transaction)
  const iconClass = getTransactionIconClass(transaction)

  return (
    <div
      className={`wallet__transaction${
        isClickable ? ' wallet__transaction--clickable' : ''
      }`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onClick?.(transaction) : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.(transaction)
              }
            }
          : undefined
      }
    >
      <div className="wallet__transaction-start">
        <span className={iconClass}>
          <TransactionIcon transaction={transaction} />
        </span>
        <div className="wallet__transaction-info">
          <div className="wallet__transaction-title">{transaction.title}</div>
          <div className="wallet__transaction-date">{transaction.date}</div>
        </div>
      </div>
      <span className={`wallet__transaction-amount ${amountClass}`}>
        <span className="wallet__transaction-unit">تومان</span>
        <span className="wallet__transaction-value">
          {formatTransactionAmount(transaction.amount, transaction.status)}
        </span>
      </span>
    </div>
  )
}

export function WalletPage() {
  const navigate = useNavigate()
  const { user, error, refetch } = useUser()
  const { haptic } = useTelegram()
  const [isBalanceLoading, setIsBalanceLoading] = useState(true)
  const [transactions, setTransactions] = useState<WalletTransaction[]>(
    () => readLocalWalletTransactions()?.items ?? [],
  )
  const [hasFetchedTransactions, setHasFetchedTransactions] = useState(
    () => Boolean(readLocalWalletTransactions()),
  )
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'info',
  })
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)

  const [isTransactionsRefreshing, setIsTransactionsRefreshing] = useState(false)

  const balance = user ? balanceToToman(user.balance) : 0

  const applyTransactionsPayload = useCallback((payload: WalletTransactionsPayload) => {
    setTransactions(payload.items)
    setTransactionsError(null)
    writeLocalWalletTransactions(payload)
  }, [])

  const refreshTransactionsInBackground = useCallback(
    async (version?: string | null) => {
      setIsTransactionsRefreshing(true)
      try {
        const syncResult = await syncWalletTransactions(version ?? undefined)
        if (syncResult.changed) {
          applyTransactionsPayload(syncResult)
        }
      } catch {
        // background sync should not block the wallet page
      } finally {
        setIsTransactionsRefreshing(false)
      }
    },
    [applyTransactionsPayload],
  )

  const loadTransactions = useCallback(async () => {
    const localCache = readLocalWalletTransactions()
    if (localCache) {
      applyTransactionsPayload(localCache)
      setHasFetchedTransactions(true)
      void refreshTransactionsInBackground(localCache.version)
      return
    }

    setTransactionsError(null)

    try {
      const payload = await fetchWalletTransactions()
      applyTransactionsPayload(payload)
      void refreshTransactionsInBackground(payload.version)
    } catch (err) {
      setTransactions([])
      setTransactionsError(err instanceof Error ? err.message : 'خطا در دریافت تراکنش‌ها')
    } finally {
      setHasFetchedTransactions(true)
    }
  }, [applyTransactionsPayload, refreshTransactionsInBackground])

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    let cancelled = false

    const loadBalance = async () => {
      setIsBalanceLoading(true)

      try {
        await refetch({ silent: true })
      } finally {
        if (!cancelled) {
          setIsBalanceLoading(false)
        }
      }
    }

    void loadBalance()

    return () => {
      cancelled = true
    }
  }, [refetch])

  useEffect(() => {
    if (!isTelegramWebApp()) return

    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return

    const handleBack = () => navigate(-1)
    backButton.show()
    backButton.onClick(handleBack)

    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [navigate])

  const handleRetryBalance = () => {
    haptic('light')
    setIsBalanceLoading(true)
    void refetch({ silent: true }).finally(() => setIsBalanceLoading(false))
  }

  const handleRetryTransactions = () => {
    haptic('light')
    void loadTransactions()
  }

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
  ) => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const handlePendingTransactionClick = useCallback(
    async (transaction: WalletTransaction) => {
      if (transaction.paymentMethod === 'tron') {
        navigate(`/wallet/charge/tron?orderId=${encodeURIComponent(transaction.orderId ?? '')}`)
        return
      }

      if (!transaction.orderId) {
        return
      }

      try {
        const response = await fetchPaymentOrder(transaction.orderId)

        if (response.payment.status === 'failed') {
          showNotification('مهلت پرداخت این تراکنش به پایان رسیده است', 'warning')
          void loadTransactions()
          return
        }

        if (response.payment.status !== 'pending' || !response.paymentUrl) {
          showNotification('این پرداخت دیگر قابل ادامه نیست', 'warning')
          void loadTransactions()
          return
        }

        openPaymentUrl(response.paymentUrl)
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : 'خطا در ادامه پرداخت',
          'error',
        )
      }
    },
    [loadTransactions, navigate],
  )

  const handleTransactionClick = useCallback(
    (transaction: WalletTransaction) => {
      haptic('light')

      // Only unpaid wallet charges / crypto deposits can be resumed.
      // Shop purchases keep status "pending" while the order is processing.
      if (transaction.status === 'pending' && transaction.type === 'deposit') {
        void handlePendingTransactionClick(transaction)
        return
      }

      setSelectedTransaction(transaction)
      setIsDetailSheetOpen(true)
    },
    [haptic, handlePendingTransactionClick],
  )

  const handleCloseDetailSheet = useCallback(() => {
    setIsDetailSheetOpen(false)
  }, [])

  return (
    <div className="wallet">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <TransactionDetailSheet
        isOpen={isDetailSheetOpen}
        transaction={selectedTransaction}
        onClose={handleCloseDetailSheet}
      />

      <div className="wallet__top">
        <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <PageHeader title="کیف پول" onBack={() => navigate(-1)} />
        </div>

        <section
          className="wallet__card shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="موجودی کیف پول"
        >
          <div className="wallet__card-top">
            <span className="wallet__card-label">موجودی کیف پول</span>
            <span className="wallet__card-icon">
              <Money03Icon width={20} height={20} />
            </span>
          </div>
          <div className="wallet__balance">
            {isBalanceLoading ? (
              <span className="wallet__balance-skeleton" aria-label="در حال بارگذاری موجودی" />
            ) : error ? (
              <div className="wallet__balance-error">
                <span className="wallet__balance-error-text">{error}</span>
                <button
                  type="button"
                  className="wallet__balance-retry"
                  onClick={handleRetryBalance}
                >
                  تلاش مجدد
                </button>
              </div>
            ) : (
              <>
                <span className="wallet__balance-amount">{balance.toLocaleString('fa-IR')}</span>
                <span className="wallet__balance-unit">تومان</span>
              </>
            )}
          </div>
        </section>

        <div className="wallet__actions">
          <Link
            to="/wallet/charge"
            className="wallet__action wallet__action--charge"
            onClick={() => haptic('light')}
          >
            <span className="wallet__action-icon">
              <MoneyAdd02Icon width={18} height={18} />
            </span>
            <span className="wallet__action-label">شارژ حساب</span>
          </Link>
          <Link
            to="/wallet/transfer"
            className="wallet__action wallet__action--transfer"
            onClick={() => haptic('light')}
          >
            <span className="wallet__action-icon">
              <MoneySend02Icon width={18} height={18} />
            </span>
            <span className="wallet__action-label">انتقال موجودی</span>
          </Link>
        </div>

        <h3
          className="wallet__section-title shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
        >
          تراکنش‌ها
          {isTransactionsRefreshing ? (
            <span className="wallet__section-sync" aria-label="در حال بروزرسانی" />
          ) : null}
        </h3>
      </div>

      <div className="wallet__transactions-scroll">
        <div className="wallet__transactions">
          {transactionsError ? (
            <EmptyState
              className="shop-rise"
              style={{ '--rise-index': 4 } as CSSProperties}
              title={transactionsError}
              action={
                <button type="button" className="wallet__balance-retry" onClick={handleRetryTransactions}>
                  تلاش مجدد
                </button>
              }
            />
          ) : hasFetchedTransactions && transactions.length === 0 ? (
            <EmptyState
              className="shop-rise"
              style={{ '--rise-index': 4 } as CSSProperties}
              title="هنوز تراکنشی ثبت نشده است"
            />
          ) : (
            transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onClick={handleTransactionClick}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
