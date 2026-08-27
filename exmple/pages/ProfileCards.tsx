import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { CenterModal } from '../components/CenterModal'
import { EmptyState } from '../components/EmptyState'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import BankCardIcon from '../components/icons/BankCardIcon'
import IdNotVerifiedIcon from '../components/icons/id-not-verified-stroke-rounded'
import IdVerifiedIcon from '../components/icons/id-verified-stroke-rounded'
import { useTelegram } from '../hooks/useTelegram'
import { useUser } from '../context/UserContext'
import { isTelegramWebApp } from '../lib/api'
import { addBankCard, listBankCards, type BankCardRecord } from '../lib/bankCards'
import { detectBankFromCardDigits, getBankVisual } from '../lib/bankDetect'
import { isValidCardNumberLength } from '../lib/card'
import '../styles/shop-rise.css'
import './ProfileCards.css'

const CARD_PATTERNS = [
  '/pattern/Pattern1.svg',
  '/pattern/Pattern2.svg',
  '/pattern/Pattern3.svg',
  '/pattern/Pattern4.svg',
  '/pattern/Pattern5.svg',
  '/pattern/Pattern6.svg',
  '/pattern/Pattern7.svg',
  '/pattern/Pattern8.svg',
  '/pattern/Pattern9.svg',
  '/pattern/Pattern10.svg',
  '/pattern/Shape1.svg',
  '/pattern/Shape2.svg',
] as const

function getCardPattern(cardId: number): string {
  return CARD_PATTERNS[cardId % CARD_PATTERNS.length]
}

function formatCardNumberDisplay(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '')
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatInputCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1-')
}

export function ProfileCardsPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { user } = useUser()
  const holderName = user?.realName?.trim() || ''

  const [bankCards, setBankCards] = useState<BankCardRecord[]>([])
  const [isLoadingCards, setIsLoadingCards] = useState(true)
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'success',
  })

  const cardsScrollContainerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  const handleBack = useCallback(() => {
    navigate('/profile', { replace: true })
  }, [navigate])

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

  const loadCards = useCallback(async () => {
    setIsLoadingCards(true)
    try {
      const response = await listBankCards()
      setBankCards(response.cards)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت کارت‌ها',
        type: 'error',
      })
    } finally {
      setIsLoadingCards(false)
    }
  }, [])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  const cardDigits = useMemo(() => cardNumber.replace(/\D/g, ''), [cardNumber])
  const detectedBank = useMemo(() => {
    const bank = detectBankFromCardDigits(cardDigits)
    if (!bank || bank.slug === 'unknown') return null
    return bank
  }, [cardDigits])

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
  ) => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const handleOpenAddCard = () => {
    haptic('light')
    setCardNumber('')
    setIsAddCardModalOpen(true)
  }

  const handleCloseAddCard = () => {
    setIsAddCardModalOpen(false)
    setCardNumber('')
  }

  const handleCardNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCardNumber(formatInputCardNumber(event.target.value))
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardsScrollContainerRef.current) return
    isDragging.current = true
    startX.current = event.pageX - cardsScrollContainerRef.current.offsetLeft
    scrollLeft.current = cardsScrollContainerRef.current.scrollLeft
    cardsScrollContainerRef.current.style.cursor = 'grabbing'
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !cardsScrollContainerRef.current) return
    event.preventDefault()
    const x = event.pageX - cardsScrollContainerRef.current.offsetLeft
    const walk = (x - startX.current) * 2
    cardsScrollContainerRef.current.scrollLeft = scrollLeft.current - walk
  }

  const handleMouseUp = () => {
    if (!cardsScrollContainerRef.current) return
    isDragging.current = false
    cardsScrollContainerRef.current.style.cursor = 'grab'
  }

  const handleAddCard = async () => {
    if (!isValidCardNumberLength(cardDigits)) {
      showNotification('شماره کارت باید ۱۶ رقم باشد', 'error')
      return
    }

    if (!detectedBank) {
      showNotification('بانک شناسایی نشد', 'error')
      return
    }

    setIsSaving(true)
    try {
      await addBankCard({
        cardNumber: cardDigits,
        bankName: detectedBank.nameFa,
        bankSlug: detectedBank.slug,
        bankBin: detectedBank.bin,
      })
      showNotification('کارت با موفقیت اضافه شد', 'success')
      handleCloseAddCard()
      await loadCards()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در افزودن کارت', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="profile-cards">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader
          title="کارت های بانکی"
          onBack={handleBack}
          action={
            <button
              type="button"
              className="page-header__action page-header__action--accent"
              onClick={handleOpenAddCard}
            >
              افزودن کارت
            </button>
          }
        />
      </div>

      <div className="profile-cards__content">
        <h2 className="profile-cards__section-title shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          کارت های بانکی
        </h2>

        <div className="profile-cards__cards-box shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          {isLoadingCards ? (
            <div className="profile-cards__scroll" aria-busy="true" aria-label="در حال بارگذاری کارت‌ها">
              <div className="profile-cards__wrapper">
                {[0, 1].map((index) => (
                  <div key={index} className="profile-cards__card profile-cards__card--skeleton">
                    <div className="profile-cards__card-top profile-cards__skeleton-top">
                      <div className="profile-cards__card-header">
                        <div className="profile-cards__skeleton-bank">
                          <span className="profile-cards__skeleton-block profile-cards__skeleton-icon" />
                          <span className="profile-cards__skeleton-block profile-cards__skeleton-name" />
                        </div>
                        <span className="profile-cards__skeleton-block profile-cards__skeleton-badge" />
                      </div>
                    </div>
                    <div className="profile-cards__card-bottom profile-cards__skeleton-bottom">
                      <span className="profile-cards__skeleton-block profile-cards__skeleton-number" />
                      <span className="profile-cards__skeleton-block profile-cards__skeleton-holder" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : bankCards.length === 0 ? (
            <EmptyState title="هیچ کارتی ثبت نشده است" />
          ) : (
            <div
              className="profile-cards__scroll"
              ref={cardsScrollContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div className="profile-cards__wrapper">
                {bankCards.map((card) => {
                  const visual = getBankVisual(card.bankSlug, card.cardNumber)
                  const displayName = card.bankName || visual.nameFa
                  const cardPattern = getCardPattern(card.id)

                  return (
                    <div key={card.id} className="profile-cards__card">
                      <div
                        className="profile-cards__card-top"
                        style={{
                          background: `linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                          backgroundImage: `url('${cardPattern}'), linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                          backgroundSize: 'cover, cover',
                          backgroundPosition: 'center, center',
                          backgroundRepeat: 'no-repeat, no-repeat',
                        }}
                      >
                        <div className="profile-cards__card-header">
                          <div className="profile-cards__bank-meta">
                            <img
                              src={visual.iconSrc}
                              alt=""
                              className="profile-cards__bank-icon"
                              width={20}
                              height={20}
                              onError={(event) => {
                                event.currentTarget.src = '/banks/unknown.svg'
                              }}
                            />
                            <span className="profile-cards__bank-name">{displayName}</span>
                          </div>
                          <span
                            className={`profile-cards__verified${card.isVerified ? ' profile-cards__verified--ok' : ' profile-cards__verified--pending'}`}
                          >
                            {card.isVerified ? (
                              <IdVerifiedIcon width={12} height={12} />
                            ) : (
                              <IdNotVerifiedIcon width={12} height={12} />
                            )}
                            <span>{card.isVerified ? 'احراز شده' : 'احراز نشده'}</span>
                          </span>
                        </div>
                      </div>
                      <div className="profile-cards__card-bottom">
                        <div className="profile-cards__card-number">
                          {formatCardNumberDisplay(card.cardNumber)}
                        </div>
                        <div className="profile-cards__card-meta">
                          {holderName}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <CenterModal
        isOpen={isAddCardModalOpen}
        onClose={handleCloseAddCard}
        title="افزودن کارت بانکی"
        description="شماره ۱۶ رقمی کارت بانکی خود را وارد کنید. بانک به‌صورت خودکار شناسایی می‌شود."
        buttons={[
          {
            label: 'انصراف',
            onClick: handleCloseAddCard,
            variant: 'default',
          },
          {
            label: isSaving ? 'در حال افزودن...' : 'ذخیره',
            onClick: () => void handleAddCard(),
            variant: 'primary',
            disabled: isSaving || !isValidCardNumberLength(cardDigits) || !detectedBank,
          },
        ]}
      >
        <div className="profile-cards__modal-field">
          <input
            type="tel"
            value={cardNumber}
            onChange={handleCardNumberChange}
            className="profile-cards__modal-input"
            placeholder="1234-5678-9012-3456"
            maxLength={19}
            inputMode="numeric"
            autoComplete="cc-number"
          />
          <span className="profile-cards__modal-icon">
            {detectedBank ? (
              <img src={detectedBank.iconSrc} alt="" width={20} height={20} />
            ) : (
              <BankCardIcon width={16} height={16} />
            )}
          </span>
        </div>
      </CenterModal>
    </div>
  )
}
