import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import SearchIcon from '../components/icons/SearchIcon'
import { useTelegram } from '../hooks/useTelegram'
import { isTransferAmountValid } from '../lib/amount'
import { isTelegramWebApp } from '../lib/telegram'
import { searchTransferRecipients } from '../lib/transfers'
import {
  formatTransferRecipientHandle,
  formatTransferRecipientName,
  formatTransferRecipientTelegramId,
  getRecentTransferRecipients,
  getTransferRecipientInitials,
  saveRecentTransferRecipient,
} from '../lib/transferRecipients'
import type { TransferRecipient, WalletTransferRecipientState } from '../types/transfer'
import '../styles/shop-rise.css'
import './WalletCharge.css'
import './WalletTransferRecipient.css'

const MIN_SEARCH_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 350

export function WalletTransferRecipientPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const transferState = location.state as WalletTransferRecipientState | null
  const amount = transferState?.amount ?? 0

  const [searchQuery, setSearchQuery] = useState('')
  const [recentRecipients, setRecentRecipients] = useState<TransferRecipient[]>([])
  const [searchResults, setSearchResults] = useState<TransferRecipient[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<TransferRecipient | null>(
    transferState?.recipient ?? null,
  )
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'info',
  })

  const trimmedSearch = searchQuery.trim()
  const isSearchMode = trimmedSearch.length >= MIN_SEARCH_LENGTH

  const handleBack = useCallback(() => {
    navigate('/wallet/transfer', { state: { amount }, replace: true })
  }, [amount, navigate])

  useEffect(() => {
    if (isTransferAmountValid(amount, Number.POSITIVE_INFINITY)) return
    navigate('/wallet/transfer', { replace: true })
  }, [amount, navigate])

  useEffect(() => {
    setRecentRecipients(getRecentTransferRecipients())
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

  useEffect(() => {
    if (!isSearchMode) {
      setSearchResults([])
      setSearchError(null)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      void searchTransferRecipients(trimmedSearch)
        .then((users) => {
          setSearchResults(users)
        })
        .catch((error: unknown) => {
          setSearchResults([])
          setSearchError(error instanceof Error ? error.message : 'خطا در جستجو')
        })
        .finally(() => {
          setIsSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isSearchMode, trimmedSearch])

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const handleSelectRecipient = (recipient: TransferRecipient) => {
    haptic('light')
    setSelectedRecipient(recipient)
    saveRecentTransferRecipient(recipient)
    setRecentRecipients(getRecentTransferRecipients())
  }

  const handleContinue = () => {
    if (!selectedRecipient) return
    haptic('light')
    navigate('/wallet/transfer/confirm', {
      state: { amount, recipient: selectedRecipient },
    })
  }

  const displayedRecipients = isSearchMode ? searchResults : recentRecipients
  const sectionTitle = isSearchMode ? 'نتایج جستجو' : 'مخاطبین اخیر'

  const emptyMessage = (() => {
    if (isSearchMode) {
      if (isSearching) return null
      if (searchError) return searchError
      return 'کاربری با این مشخصات پیدا نشد.'
    }

    return 'هنوز مخاطبی انتخاب نکرده‌اید. با جستجوی نام، یوزرنیم یا شناسه، گیرنده را پیدا کنید.'
  })()

  return (
    <div className="wallet-charge transfer-recipient">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="انتخاب گیرنده" onBack={handleBack} />
      </div>

      <div className="wallet-charge__body transfer-recipient__body">
        <div className="transfer-recipient__content">
          <div
            className="transfer-recipient__search shop-rise"
            style={{ '--rise-index': 1 } as CSSProperties}
          >
            <span className="transfer-recipient__search-icon" aria-hidden="true">
              <SearchIcon width={18} height={18} color="currentColor" />
            </span>
            <input
              type="search"
              className="transfer-recipient__search-input"
              placeholder="نام، یوزرنیم یا شناسه"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="جستجو با نام، یوزرنیم یا شناسه عددی"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>

          <h3
            className="transfer-recipient__section-title shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
          >
            {sectionTitle}
          </h3>

          <div className="transfer-recipient__list">
            {isSearchMode && isSearching ? (
              <div
                className="transfer-recipient__empty transfer-recipient__empty--loading shop-rise"
                style={{ '--rise-index': 3 } as CSSProperties}
              >
                در حال جستجو...
              </div>
            ) : displayedRecipients.length === 0 ? (
              emptyMessage ? (
                <EmptyState
                  compact
                  className={`shop-rise${searchError ? ' transfer-recipient__empty--error' : ''}`}
                  style={{ '--rise-index': 3 } as CSSProperties}
                  title={emptyMessage}
                />
              ) : null
            ) : (
              displayedRecipients.map((recipient) => {
                const isSelected = selectedRecipient?.telegramId === recipient.telegramId
                const handle = formatTransferRecipientHandle(recipient)

                return (
                  <button
                    key={recipient.telegramId}
                    type="button"
                    className={`transfer-recipient__item${
                      isSelected ? ' transfer-recipient__item--selected' : ''
                    }`}
                    onClick={() => handleSelectRecipient(recipient)}
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
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      <footer
        className="wallet-charge__footer shop-rise"
        style={{ '--rise-index': 20 } as CSSProperties}
      >
        <button
          type="button"
          className="wallet-charge__continue"
          disabled={!selectedRecipient}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
