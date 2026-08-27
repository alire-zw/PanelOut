import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import CopyIcon from '../components/icons/CopyIcon'
import { SolarIcon } from '../components/SolarIcon'
import { useTelegram } from '../hooks/useTelegram'
import { formatAmountFa, isChargeAmountValid } from '../lib/amount'
import {
  fetchActiveBankCardsPayload,
  readLocalBankCards,
  syncActiveBankCards,
  writeLocalBankCards,
} from '../lib/bankCards'
import { getBankVisual, getRandomCardPattern } from '../lib/bankDetect'
import {
  formatCardNumberDisplay,
  formatShebaDisplay,
  submitCardCharge,
  uploadReceiptWithProgress,
} from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import type { BankCard } from '../types/payments'
import type { WalletChargeAmountState } from '../types/wallet'
import '../styles/shop-rise.css'
import './WalletCardCharge.css'

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return {
    base64: btoa(binary),
    mimeType: file.type || 'image/jpeg',
  }
}

function pickRandomCard(cards: BankCard[]): BankCard | null {
  if (cards.length === 0) return null
  const index = Math.floor(Math.random() * cards.length)
  return cards[index] ?? null
}

function formatFileSizeFa(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString('fa-IR')} بایت`
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلوبایت`
  }
  return `${(bytes / (1024 * 1024)).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`
}

const RECEIPT_SEQ_KEY = 'panelout:receipt-display-seq'
const RECEIPT_SEQ_START = 10001

function nextReceiptDisplayNumber(): number {
  try {
    const raw = window.localStorage.getItem(RECEIPT_SEQ_KEY)
    const current = raw ? Number(raw) : RECEIPT_SEQ_START
    const next =
      Number.isFinite(current) && current >= RECEIPT_SEQ_START ? Math.trunc(current) : RECEIPT_SEQ_START
    window.localStorage.setItem(RECEIPT_SEQ_KEY, String(next + 1))
    return next
  } catch {
    return RECEIPT_SEQ_START
  }
}

function toFaDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit)
}

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

export function WalletCardChargePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const receiptFileRef = useRef<File | null>(null)
  const chargeState = location.state as WalletChargeAmountState | null
  const amount = chargeState?.amount ?? 0

  const [selectedCard, setSelectedCard] = useState<BankCard | null>(null)
  const [cardPattern, setCardPattern] = useState(() => getRandomCardPattern())
  const [loadingCards, setLoadingCards] = useState(true)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptLabelNumber, setReceiptLabelNumber] = useState(0)
  const [receiptFileSize, setReceiptFileSize] = useState(0)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [receiptMime, setReceiptMime] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'success' })

  const handleBack = useCallback(() => {
    navigate('/wallet/charge/payment', { state: { amount }, replace: true })
  }, [navigate, amount])

  useEffect(() => {
    if (isChargeAmountValid(amount)) return
    navigate('/wallet/charge', { replace: true })
  }, [amount, navigate])

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

  useEffect(() => {
    let cancelled = false

    const applyCards = (cards: BankCard[], keepSelection = false) => {
      setSelectedCard((prev) => {
        if (keepSelection && prev && cards.some((card) => card.id === prev.id)) {
          return prev
        }
        return pickRandomCard(cards)
      })
      setCardPattern((prev) => prev || getRandomCardPattern())
    }

    const load = async () => {
      const localCache = readLocalBankCards('active')
      if (localCache?.cards.length) {
        if (!cancelled) {
          applyCards(localCache.cards)
          setLoadingCards(false)
        }
        try {
          const syncResult = await syncActiveBankCards(localCache.version)
          if (cancelled) return
          if (syncResult.changed) {
            writeLocalBankCards(syncResult)
            applyCards(syncResult.cards, true)
          }
        } catch {
          // keep local card
        }
        return
      }

      setLoadingCards(true)
      try {
        const payload = await fetchActiveBankCardsPayload()
        if (cancelled) return
        writeLocalBankCards(payload)
        applyCards(payload.cards)
        void syncActiveBankCards(payload.version).then((syncResult) => {
          if (cancelled || !syncResult.changed) return
          writeLocalBankCards(syncResult)
          applyCards(syncResult.cards, true)
        })
      } catch (error) {
        if (!cancelled) {
          setNotification({
            show: true,
            message: error instanceof Error ? error.message : 'خطا در دریافت کارت‌ها',
            type: 'error',
          })
        }
      } finally {
        if (!cancelled) setLoadingCards(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      haptic('light')
      setNotification({ show: true, message: `${label} کپی شد`, type: 'success' })
    } catch {
      setNotification({ show: true, message: 'کپی ناموفق بود', type: 'error' })
    }
  }

  const startUpload = useCallback(
    async (file: File) => {
      setReceiptPath(null)
      setReceiptMime(null)
      setUploadStatus('uploading')
      setUploadProgress(0)

      try {
        const { base64, mimeType } = await fileToBase64(file)
        const receipt = await uploadReceiptWithProgress(
          { receiptBase64: base64, receiptMimeType: mimeType },
          (percent) => setUploadProgress(percent),
        )
        setReceiptPath(receipt.receiptPath)
        setReceiptMime(receipt.receiptMime)
        setReceiptFileSize(receipt.size || file.size)
        setUploadProgress(100)
        setUploadStatus('done')
        haptic('light')
      } catch (error) {
        setUploadStatus('error')
        setReceiptPath(null)
        setNotification({
          show: true,
          message: error instanceof Error ? error.message : 'آپلود رسید ناموفق بود',
          type: 'error',
        })
      }
    },
    [haptic],
  )

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotification({ show: true, message: 'فقط تصویر رسید مجاز است', type: 'error' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotification({ show: true, message: 'حجم تصویر حداکثر ۵ مگابایت باشد', type: 'error' })
      return
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    receiptFileRef.current = file

    setReceiptPreview(previewUrl)
    setReceiptLabelNumber(nextReceiptDisplayNumber())
    setReceiptFileSize(file.size)
    void startUpload(file)
  }

  const handleRetryUpload = () => {
    const file = receiptFileRef.current
    if (!file || uploadStatus === 'uploading') return
    void startUpload(file)
  }

  const handleSubmit = async () => {
    if (!selectedCard || !receiptPath || !receiptMime || uploadStatus !== 'done' || submitting) {
      return
    }
    setSubmitting(true)
    try {
      await submitCardCharge({
        amount,
        bankCardId: selectedCard.id,
        receiptPath,
        receiptMimeType: receiptMime,
      })
      haptic('medium')
      setNotification({
        show: true,
        message: 'رسید ارسال شد و پس از تأیید ادمین کیف پول شارژ می‌شود',
        type: 'success',
      })
      window.setTimeout(() => navigate('/wallet', { replace: true }), 1200)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'ارسال رسید ناموفق بود',
        type: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isChargeAmountValid(amount)) return null

  const visual = selectedCard ? getBankVisual(null, selectedCard.cardNumber) : null
  const pattern = selectedCard ? cardPattern : null
  const canSubmit = Boolean(selectedCard && receiptPath && uploadStatus === 'done' && !submitting)

  return (
    <div className="wallet-card-charge">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="واریز کارت‌به‌کارت" onBack={handleBack} />
      </div>

      <div className="wallet-card-charge__scroll">
        <section
          className="wallet-card-charge__summary shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          <span className="wallet-card-charge__summary-label">مبلغ واریزی</span>
          <div className="wallet-card-charge__summary-value-row">
            <span className="wallet-card-charge__summary-unit">تومان</span>
            <span className="wallet-card-charge__summary-value">
              {formatAmountFa(String(amount))}
            </span>
          </div>
        </section>

        <div
          className="wallet-card-charge__info shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
          role="note"
        >
          <SolarIcon
            icon="solar:info-square-bold-duotone"
            width={18}
            height={18}
            color="var(--accent)"
            className="wallet-card-charge__info-icon"
          />
          <p className="wallet-card-charge__info-text">
            مبلغ را به کارت زیر واریز کنید و تصویر رسید را بارگذاری نمایید. پس از بررسی و تأیید
            توسط پشتیبانی، موجودی کیف پول شما شارژ خواهد شد.
          </p>
        </div>

        {loadingCards ? (
          <div
            className="wallet-card-charge__visual wallet-card-charge__visual--skeleton shop-rise"
            style={{ '--rise-index': 3 } as CSSProperties}
            aria-busy="true"
          >
            <div className="wallet-card-charge__visual-top wallet-card-charge__skeleton-top">
              <div className="wallet-card-charge__visual-header">
                <div className="wallet-card-charge__skeleton-bank">
                  <span className="wallet-card-charge__skeleton-block wallet-card-charge__skeleton-icon" />
                  <span className="wallet-card-charge__skeleton-block wallet-card-charge__skeleton-name" />
                </div>
                <div className="wallet-card-charge__skeleton-actions">
                  <span className="wallet-card-charge__skeleton-block wallet-card-charge__skeleton-badge" />
                  <span className="wallet-card-charge__skeleton-block wallet-card-charge__skeleton-badge" />
                </div>
              </div>
            </div>
            <div className="wallet-card-charge__visual-bottom wallet-card-charge__skeleton-bottom">
              <div className="wallet-card-charge__bottom-row">
                <div className="wallet-card-charge__numbers">
                  <span className="wallet-card-charge__skeleton-block wallet-card-charge__skeleton-number" />
                  <span className="wallet-card-charge__skeleton-block wallet-card-charge__skeleton-sheba" />
                </div>
                <span className="wallet-card-charge__skeleton-block wallet-card-charge__skeleton-holder" />
              </div>
            </div>
          </div>
        ) : null}

        {!loadingCards && !selectedCard ? (
          <p className="wallet-card-charge__status">فعلاً کارت فعالی برای واریز ثبت نشده است</p>
        ) : null}

        {!loadingCards && selectedCard && visual && pattern ? (
          <div
            className="wallet-card-charge__visual shop-rise"
            style={{ '--rise-index': 3 } as CSSProperties}
          >
            <div
              className="wallet-card-charge__visual-top"
              style={{
                background: `linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                backgroundImage: `url('${pattern}'), linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                backgroundSize: 'cover, cover',
                backgroundPosition: 'center, center',
                backgroundRepeat: 'no-repeat, no-repeat',
              }}
            >
              <div className="wallet-card-charge__visual-header">
                <div className="wallet-card-charge__bank-meta">
                  <img
                    src={visual.iconSrc}
                    alt=""
                    className="wallet-card-charge__bank-icon"
                    width={20}
                    height={20}
                    onError={(event) => {
                      event.currentTarget.src = '/banks/unknown.svg'
                    }}
                  />
                  <span className="wallet-card-charge__bank-name">{visual.nameFa}</span>
                </div>
                <div className="wallet-card-charge__copy-actions">
                  <button
                    type="button"
                    className="wallet-card-charge__copy-badge"
                    onClick={() => void copyText(selectedCard.cardNumber, 'شماره کارت')}
                  >
                    <CopyIcon width={12} height={12} />
                    کپی کارت
                  </button>
                  {selectedCard.sheba ? (
                    <button
                      type="button"
                      className="wallet-card-charge__copy-badge"
                      onClick={() => void copyText(selectedCard.sheba!, 'شبا')}
                    >
                      <CopyIcon width={12} height={12} />
                      کپی شبا
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="wallet-card-charge__visual-bottom">
              <div className="wallet-card-charge__bottom-row">
                <div className="wallet-card-charge__numbers">
                  <div className="wallet-card-charge__card-number">
                    {formatCardNumberDisplay(selectedCard.cardNumber)}
                  </div>
                  {selectedCard.sheba ? (
                    <div className="wallet-card-charge__card-sheba">
                      {formatShebaDisplay(selectedCard.sheba)}
                    </div>
                  ) : null}
                </div>
                <div className="wallet-card-charge__holder">{selectedCard.holderName}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="wallet-card-charge__upload shop-rise"
          style={{ '--rise-index': 4 } as CSSProperties}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="wallet-card-charge__file"
            onChange={handleFileChange}
          />

          {uploadStatus === 'idle' ? (
            <button
              type="button"
              className="wallet-card-charge__upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="wallet-card-charge__upload-btn-title">آپلود تصویر رسید</span>
              <span className="wallet-card-charge__upload-btn-hint">
                JPG، PNG یا WEBP — حداکثر ۵ مگابایت
              </span>
            </button>
          ) : (
            <div
              className={`wallet-card-charge__receipt wallet-card-charge__receipt--${uploadStatus}`}
            >
              <div className="wallet-card-charge__receipt-main">
                <div className="wallet-card-charge__receipt-thumb-wrap">
                  {receiptPreview ? (
                    <img
                      className="wallet-card-charge__receipt-thumb"
                      src={receiptPreview}
                      alt=""
                    />
                  ) : (
                    <div className="wallet-card-charge__receipt-thumb wallet-card-charge__receipt-thumb--empty" />
                  )}
                  {uploadStatus === 'done' ? (
                    <span className="wallet-card-charge__receipt-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </div>
                <div className="wallet-card-charge__receipt-meta">
                  <div className="wallet-card-charge__receipt-title-row">
                    <span className="wallet-card-charge__receipt-name">
                      تصویر رسید {toFaDigits(receiptLabelNumber)}
                    </span>
                    {uploadStatus === 'done' ? (
                      <span className="wallet-card-charge__receipt-badge wallet-card-charge__receipt-badge--done">
                        آپلود شد
                      </span>
                    ) : null}
                    {uploadStatus === 'error' ? (
                      <span className="wallet-card-charge__receipt-badge wallet-card-charge__receipt-badge--error">
                        ناموفق
                      </span>
                    ) : null}
                    {uploadStatus === 'uploading' ? (
                      <span className="wallet-card-charge__receipt-badge wallet-card-charge__receipt-badge--loading">
                        {toFaDigits(uploadProgress)}٪
                      </span>
                    ) : null}
                  </div>
                  <span className="wallet-card-charge__receipt-size">
                    حجم فایل · {formatFileSizeFa(receiptFileSize)}
                  </span>
                  {uploadStatus === 'uploading' ? (
                    <span className="wallet-card-charge__receipt-status">در حال ارسال به سرور…</span>
                  ) : null}
                  {uploadStatus === 'error' ? (
                    <span className="wallet-card-charge__receipt-status wallet-card-charge__receipt-status--error">
                      آپلود انجام نشد؛ دوباره تلاش کنید
                    </span>
                  ) : null}
                </div>
              </div>

              {uploadStatus === 'uploading' ? (
                <div
                  className="wallet-card-charge__progress"
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="wallet-card-charge__progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : null}

              <div className="wallet-card-charge__receipt-footer">
                {uploadStatus === 'error' ? (
                  <button
                    type="button"
                    className="wallet-card-charge__receipt-retry"
                    onClick={handleRetryUpload}
                  >
                    تلاش مجدد
                  </button>
                ) : (
                  <span className="wallet-card-charge__receipt-footer-hint">
                    {uploadStatus === 'done' ? 'آماده ارسال برای بررسی' : 'لطفاً صبر کنید'}
                  </span>
                )}
                <button
                  type="button"
                  className="wallet-card-charge__receipt-change"
                  disabled={uploadStatus === 'uploading'}
                  onClick={() => fileInputRef.current?.click()}
                >
                  تغییر تصویر
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="wallet-card-charge__footer">
        <button
          type="button"
          className="wallet-card-charge__submit"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {submitting ? 'در حال ارسال...' : 'ارسال برای بررسی'}
        </button>
      </footer>
    </div>
  )
}
