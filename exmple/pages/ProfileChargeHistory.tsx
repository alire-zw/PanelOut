import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'
import DepositCryptoIcon from '../components/icons/DepositCryptoIcon'
import Money03Icon from '../components/icons/money-03-stroke-rounded'
import MoneyPending02Icon from '../components/icons/money-pending-02-stroke-rounded'
import MoneyReceive02Icon from '../components/icons/money-receive-02-stroke-rounded'
import MoneyRemove02Icon from '../components/icons/money-remove-02-stroke-rounded'
import MoneySendFlow02Icon from '../components/icons/money-send-flow-02-stroke-rounded'
import HandCoinsIcon from '../components/icons/hand-coins-stroke-rounded'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import { fetchClubPoints, syncClubPoints } from '../lib/club'
import { fetchPaymentOrder, openPaymentUrl } from '../lib/payments'
import {
  fetchWalletTransactions,
  readLocalWalletTransactions,
  syncWalletTransactions,
  writeLocalWalletTransactions,
  type WalletTransactionsPayload,
} from '../lib/walletTransactions'
import type { WalletTransaction, WalletTransactionStatus } from '../types/wallet'
import '../styles/shop-rise.css'
import './Wallet.css'
import './ProfileChargeHistory.css'

function isChargeHistoryTransaction(transaction: WalletTransaction): boolean {
  return transaction.type === 'deposit' || transaction.type === 'purchase'
}

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

export function ProfileChargeHistoryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const { user } = useUser()

  const returnTo =
    location.state &&
    typeof location.state === 'object' &&
    'returnTo' in location.state &&
    typeof (location.state as { returnTo: unknown }).returnTo === 'string'
      ? (location.state as { returnTo: string }).returnTo
      : '/profile'

  const [clubPoints, setClubPoints] = useState(() => user?.clubPoints ?? 0)
  const [isClubPointsLoading, setIsClubPointsLoading] = useState(() => user?.clubPoints == null)

  const [transactions, setTransactions] = useState<WalletTransaction[]>(
    () => (readLocalWalletTransactions()?.items ?? []).filter(isChargeHistoryTransaction),
  )
  const [hasFetchedTransactions, setHasFetchedTransactions] = useState(
    () => Boolean(readLocalWalletTransactions()),
  )
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [isTransactionsRefreshing, setIsTransactionsRefreshing] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'info',
  })

  const handleBack = useCallback(() => {
    navigate(returnTo, { replace: true })
  }, [navigate, returnTo])

  const applyTransactionsPayload = useCallback((payload: WalletTransactionsPayload) => {
    setTransactions(payload.items.filter(isChargeHistoryTransaction))
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
        // background sync should not block the page
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

    const loadClubPoints = async () => {
      try {
        const result = await fetchClubPoints()
        if (cancelled) return
        setClubPoints(result.clubPoints)
        setIsClubPointsLoading(false)
      } catch {
        if (!cancelled) {
          setClubPoints(user?.clubPoints ?? 0)
          setIsClubPointsLoading(false)
        }
      }

      // Recalculate from purchases in background; Redis/DB keep the fast path warm.
      void syncClubPoints()
        .then((result) => {
          if (!cancelled) {
            setClubPoints(result.clubPoints)
          }
        })
        .catch(() => {
          // keep cached value
        })
    }

    void loadClubPoints()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const totals = useMemo(() => {
    let chargeTotal = 0
    let purchaseTotal = 0

    for (const transaction of transactions) {
      if (transaction.status !== 'success') continue

      if (transaction.type === 'deposit') {
        chargeTotal += Math.abs(transaction.amount)
        continue
      }

      if (transaction.type === 'purchase') {
        purchaseTotal += Math.abs(transaction.amount)

        if (transaction.paymentMethod === 'zibal' || transaction.paymentMethod === 'tron') {
          const gatewayPart =
            typeof transaction.gatewayAmountToman === 'number' &&
            transaction.gatewayAmountToman > 0
              ? transaction.gatewayAmountToman
              : Math.abs(transaction.amount)
          chargeTotal += gatewayPart
        }
      }
    }

    return { chargeTotal, purchaseTotal }
  }, [transactions])

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
  ) => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const handleRetryTransactions = () => {
    haptic('light')
    void loadTransactions()
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

  const showSkeleton = !hasFetchedTransactions && transactions.length === 0 && !transactionsError

  return (
    <div className="wallet charge-history">
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
          <PageHeader title="تاریخچه شارژ حساب" onBack={handleBack} />
        </div>

        <section
          className="wallet__card charge-history__summary shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="خلاصه شارژ و خرید"
        >
          <div className="charge-history__summary-grid">
            <div className="charge-history__summary-item">
              <div className="charge-history__summary-top">
                <span className="wallet__card-icon charge-history__summary-icon--charge">
                  <MoneyReceive02Icon width={16} height={16} />
                </span>
                <span className="wallet__card-label">مجموع شارژ حساب</span>
              </div>
              <div className="wallet__balance">
                {showSkeleton ? (
                  <span className="wallet__balance-skeleton" aria-label="در حال بارگذاری" />
                ) : (
                  <>
                    <span className="wallet__balance-unit">تومان</span>
                    <span className="wallet__balance-amount">
                      {totals.chargeTotal.toLocaleString('fa-IR')}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="charge-history__summary-divider" aria-hidden />

            <div className="charge-history__summary-item">
              <div className="charge-history__summary-top">
                <span className="wallet__card-icon charge-history__summary-icon--purchase">
                  <MoneySendFlow02Icon width={16} height={16} />
                </span>
                <span className="wallet__card-label">مجموع خریدها</span>
              </div>
              <div className="wallet__balance">
                {showSkeleton ? (
                  <span className="wallet__balance-skeleton" aria-label="در حال بارگذاری" />
                ) : (
                  <>
                    <span className="wallet__balance-unit">تومان</span>
                    <span className="wallet__balance-amount">
                      {totals.purchaseTotal.toLocaleString('fa-IR')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="charge-history__club">
            <div className="charge-history__club-start">
              <span className="wallet__card-icon charge-history__summary-icon--club">
                <HandCoinsIcon width={16} height={16} />
              </span>
              <span className="wallet__card-label">کلاب پوینت</span>
            </div>
            <div className="charge-history__club-value">
              {isClubPointsLoading && clubPoints === 0 ? (
                <span className="wallet__balance-skeleton" aria-label="در حال بارگذاری کلاب پوینت" />
              ) : (
                <>
                  <span className="wallet__balance-unit">پوینت</span>
                  <span className="wallet__balance-amount">
                    {clubPoints.toLocaleString('fa-IR')}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        <h3
          className="wallet__section-title shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
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
              style={{ '--rise-index': 3 } as CSSProperties}
              title={transactionsError}
              action={
                <button type="button" className="wallet__balance-retry" onClick={handleRetryTransactions}>
                  تلاش مجدد
                </button>
              }
            />
          ) : showSkeleton ? (
            [0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="wallet__transaction wallet__transaction--skeleton shop-rise"
                style={{ '--rise-index': 3 + index } as CSSProperties}
              >
                <div className="wallet__transaction-start">
                  <span className="wallet__transaction-skeleton-icon" />
                  <div className="wallet__transaction-info">
                    <span className="wallet__transaction-skeleton-title" />
                    <span className="wallet__transaction-skeleton-date" />
                  </div>
                </div>
                <span className="wallet__transaction-skeleton-amount" />
              </div>
            ))
          ) : hasFetchedTransactions && transactions.length === 0 ? (
            <EmptyState
              className="shop-rise"
              style={{ '--rise-index': 3 } as CSSProperties}
              title="هنوز شارژ یا خریدی ثبت نشده است"
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
