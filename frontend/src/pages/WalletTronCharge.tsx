import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCode } from 'react-qrcode-logo'
import { PageHeader } from '../components/PageHeader'
import PaymentFailedIcon from '../components/icons/PaymentFailedIcon'
import { useUser } from '../context/UserContext'
import { useTelegram } from '../hooks/useTelegram'
import { isChargeAmountValid } from '../lib/amount'
import { fetchTronDeposit, fetchTronTransaction } from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import {
  readLocalWalletTransactions,
  syncWalletTransactions,
  writeLocalWalletTransactions,
} from '../lib/walletTransactions'
import type { WalletChargeAmountState } from '../types/wallet'
import '../styles/shop-rise.css'
import './WalletTronCharge.css'

const STATUS_POLL_MS = 10_000

function resolveQrColors() {
  const accent =
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#93cb2e'
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'

  return {
    fgColor: isLight ? '#18181b' : '#111113',
    eyeColor: accent,
    bgColor: '#ffffff',
  }
}

function formatTrxAmount(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00'
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

function formatToman(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '۰'
  const amount = typeof value === 'string' ? Number.parseInt(value, 10) : value
  if (!Number.isFinite(amount)) return '۰'
  return amount.toLocaleString('fa-IR')
}

function TronPaymentSkeleton() {
  return (
    <div className="tron-payment__skeleton">
      <div className="tron-payment__skeleton-title-row">
        <div className="tron-payment__skeleton-block tron-payment__skeleton-title" />
        <div className="tron-payment__skeleton-block tron-payment__skeleton-timer" />
      </div>
      <div className="tron-payment__skeleton-block tron-payment__skeleton-instructions" />
      <div className="tron-payment__skeleton-address-row">
        <div className="tron-payment__skeleton-block tron-payment__skeleton-qr" />
        <div className="tron-payment__skeleton-block tron-payment__skeleton-address" />
      </div>
      <div className="tron-payment__skeleton-block tron-payment__skeleton-amount" />
    </div>
  )
}

type DepositView = {
  address: string
  trxPriceIrt: number
  amountToman: number | null
  suggestedTrx: number | null
}

export function WalletTronChargePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const chargeState = location.state as WalletChargeAmountState | null
  const amountFromState = chargeState?.amount ?? 0
  const { haptic } = useTelegram()
  const { refetch: refetchUser } = useUser()

  const [deposit, setDeposit] = useState<DepositView | null>(null)
  const [txDetail, setTxDetail] = useState<{
    id: number
    txHash: string
    amountTrx: string
    amountIrt: number
    trxPriceIrt: number
    address: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [qrColors, setQrColors] = useState(resolveQrColors)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const baselineTxIdsRef = useRef<Set<string> | null>(null)
  const isReadOnly = Boolean(orderId && txDetail)

  const handleBack = useCallback(() => {
    if (orderId) {
      navigate('/wallet', { replace: true })
      return
    }
    navigate('/wallet/charge/payment', {
      state: { amount: isChargeAmountValid(amountFromState) ? amountFromState : undefined },
      replace: true,
    })
  }, [navigate, orderId, amountFromState])

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const checkPaymentStatus = useCallback(
    async (options?: { manual?: boolean }) => {
      if (options?.manual) {
        setIsChecking(true)
      }

      try {
        await refetchUser({ silent: true })

        const local = readLocalWalletTransactions()
        const syncResult = await syncWalletTransactions(local?.version ?? undefined)
        if (syncResult.changed) {
          writeLocalWalletTransactions(syncResult)
        }

        const items = syncResult.changed ? syncResult.items : local?.items ?? []
        const baseline = baselineTxIdsRef.current

        if (baseline) {
          const newTronDeposit = items.find(
            (item) =>
              item.paymentMethod === 'tron' &&
              item.status === 'success' &&
              !baseline.has(item.id),
          )

          if (newTronDeposit) {
            clearPoll()
            navigate('/wallet', { replace: true })
            return
          }
        }
      } catch {
        if (options?.manual) {
          setError('بررسی وضعیت پرداخت ناموفق بود')
        }
      } finally {
        if (options?.manual) {
          setIsChecking(false)
        }
      }
    },
    [clearPoll, navigate, refetchUser],
  )

  const loadPage = useCallback(async () => {
    setError(null)

    try {
      if (orderId) {
        const tx = await fetchTronTransaction(Number(orderId))
        setTxDetail({
          id: tx.id,
          txHash: tx.txHash,
          amountTrx: tx.amountTrx,
          amountIrt: tx.amountIrt,
          trxPriceIrt: tx.trxPriceIrt,
          address: '',
        })
        setDeposit(null)
        return
      }

      if (!isChargeAmountValid(amountFromState)) {
        setError('مبلغ شارژ نامعتبر است')
        return
      }

      const nextDeposit = await fetchTronDeposit(amountFromState)
      setDeposit(nextDeposit)
      setTxDetail(null)

      const local = readLocalWalletTransactions()
      baselineTxIdsRef.current = new Set((local?.items ?? []).map((item) => item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات پرداخت')
    } finally {
      setLoading(false)
    }
  }, [amountFromState, orderId])

  useEffect(() => {
    if (!orderId && !isChargeAmountValid(amountFromState)) {
      navigate('/wallet/charge', { replace: true })
      return
    }

    setQrColors(resolveQrColors())
    void loadPage()
  }, [amountFromState, loadPage, navigate, orderId])

  useEffect(() => {
    if (loading || error || orderId || !deposit) {
      return
    }

    pollRef.current = setInterval(() => {
      void checkPaymentStatus()
    }, STATUS_POLL_MS)

    return () => {
      clearPoll()
    }
  }, [checkPaymentStatus, clearPoll, deposit, error, loading, orderId])

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      haptic('light')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('کپی آدرس انجام نشد')
    }
  }

  const handleCheckPayment = () => {
    haptic('light')
    if (isReadOnly) {
      navigate('/wallet', { replace: true })
      return
    }
    void checkPaymentStatus({ manual: true })
  }

  if (!orderId && !isChargeAmountValid(amountFromState)) {
    return null
  }

  if (loading && !deposit && !txDetail) {
    return (
      <div className="tron-payment">
        <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <PageHeader title="پرداخت با ترون" onBack={handleBack} />
        </div>
        <div className="tron-payment__content">
          <div className="tron-payment__card shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
            <TronPaymentSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (error || (!deposit && !txDetail)) {
    return (
      <div className="tron-payment">
        <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <PageHeader title="پرداخت با ترون" onBack={handleBack} />
        </div>
        <div className="tron-payment__state shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <div className="tron-payment__icon tron-payment__icon--error">
            <PaymentFailedIcon width={48} height={48} />
          </div>
          <h2 className="tron-payment__title tron-payment__title--center">خطا</h2>
          <p className="tron-payment__description">{error ?? 'اطلاعات پرداخت یافت نشد'}</p>
        </div>
        <footer className="tron-payment__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <button
            type="button"
            className="tron-payment__footer-btn"
            disabled={isChecking}
            onClick={handleCheckPayment}
          >
            {isChecking ? 'در حال بررسی...' : 'بررسی پرداخت'}
          </button>
        </footer>
      </div>
    )
  }

  const walletAddress = deposit?.address ?? ''
  const amountToman = deposit?.amountToman ?? txDetail?.amountIrt ?? null
  const amountTrx = deposit?.suggestedTrx ?? Number.parseFloat(txDetail?.amountTrx ?? '0')
  const trxPriceIrt = deposit?.trxPriceIrt ?? txDetail?.trxPriceIrt ?? 0
  const displayOrderId = orderId ?? (deposit ? deposit.address.slice(-8) : '')

  return (
    <div className="tron-payment">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="پرداخت با ترون" onBack={handleBack} />
      </div>

      <div className="tron-payment__content">
        <div className="tron-payment__card shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <div className="tron-payment__title-row">
            <h1 className="tron-payment__title">پرداخت با ترون</h1>
            <div className="tron-payment__timer-wrap">
              <div className="tron-payment__timer-label">
                {isReadOnly ? 'وضعیت پرداخت:' : 'مهلت واریز:'}
              </div>
              <div className="tron-payment__timer tron-payment__timer--static">
                {isReadOnly ? 'تأیید شده' : 'نامحدود'}
              </div>
            </div>
          </div>

          <div className="tron-payment__instructions">
            {isReadOnly ? (
              <>
                <p>
                  واریز <strong>{formatTrxAmount(txDetail?.amountTrx)} TRX</strong> با موفقیت تأیید
                  شد.
                </p>
                <p>مبلغ معادل به موجودی کیف پول شما اضافه شده است.</p>
              </>
            ) : (
              <>
                <p>
                  لطفاً دقیقاً <strong>{formatTrxAmount(amountTrx)} TRX</strong> را به آدرس زیر
                  ارسال کنید.
                </p>
                <p>فقط TRX ارسال کنید؛ USDT و سایر توکن‌ها پذیرفته نمی‌شوند.</p>
                <p>پس از ارسال، پرداخت به صورت خودکار تأیید می‌شود.</p>
              </>
            )}
          </div>

          {!isReadOnly && walletAddress ? (
            <div className="tron-payment__address-row">
              <div className="tron-payment__qr-box">
                <QRCode
                  value={walletAddress}
                  size={118}
                  ecLevel="H"
                  qrStyle="dots"
                  eyeRadius={6}
                  eyeColor={qrColors.eyeColor}
                  bgColor={qrColors.bgColor}
                  fgColor={qrColors.fgColor}
                  quietZone={6}
                />
              </div>
              <div className="tron-payment__address-box">
                <div className="tron-payment__address-label">آدرس کیف پول:</div>
                <div className="tron-payment__address-value-wrap">
                  <code className="tron-payment__address-value">{walletAddress}</code>
                </div>
                <button
                  type="button"
                  className="tron-payment__copy-btn"
                  onClick={() => void copyToClipboard(walletAddress)}
                >
                  {copied ? 'کپی شد!' : 'کپی'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="tron-payment__amount-box">
            <div className="tron-payment__row">
              <span className="tron-payment__label">مبلغ پرداخت:</span>
              <span className="tron-payment__value tron-payment__value--amount">
                {formatToman(amountToman)} تومان
              </span>
            </div>
            <div className="tron-payment__row">
              <span className="tron-payment__label">مبلغ TRX:</span>
              <span className="tron-payment__value">{formatTrxAmount(amountTrx)} TRX</span>
            </div>
            <div className="tron-payment__row">
              <span className="tron-payment__label">قیمت TRX:</span>
              <span className="tron-payment__value">{formatToman(trxPriceIrt)} تومان</span>
            </div>
            <div className="tron-payment__row">
              <span className="tron-payment__label">شماره سفارش:</span>
              <span className="tron-payment__value">{displayOrderId}</span>
            </div>
            {txDetail?.txHash ? (
              <div className="tron-payment__row">
                <span className="tron-payment__label">TXID:</span>
                <span className="tron-payment__value">{txDetail.txHash.slice(0, 16)}…</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="tron-payment__footer shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
        <button
          type="button"
          className="tron-payment__footer-btn"
          disabled={isChecking}
          onClick={handleCheckPayment}
        >
          {isReadOnly
            ? 'بازگشت به کیف پول'
            : isChecking
              ? 'در حال بررسی...'
              : 'بررسی پرداخت'}
        </button>
      </footer>
    </div>
  )
}
