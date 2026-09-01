import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { CenterModal } from '../components/CenterModal'
import { Notification } from '../components/Notification'
import { PageHeader } from '../components/PageHeader'
import { useAdminAccess } from '../hooks/useAdminAccess'
import { useTelegram } from '../hooks/useTelegram'
import {
  fetchAdminBankCardsPayload,
  readLocalBankCards,
  syncAdminBankCards,
  writeLocalBankCards,
  type BankCardsPayload,
} from '../lib/bankCards'
import { getBankVisual, getCardPattern, getCardTopBackgroundStyle, preloadCardPatterns } from '../lib/bankDetect'
import {
  createAdminCard,
  deleteAdminCard,
  formatCardNumberDisplay,
  formatShebaDisplay,
  updateAdminCard,
} from '../lib/paymentsApi'
import { isTelegramWebApp } from '../lib/telegram'
import type { BankCard } from '../types/payments'
import '../styles/shop-rise.css'
import './Admin.css'

type FormState = {
  cardNumber: string
  sheba: string
  holderName: string
}

const EMPTY_FORM: FormState = { cardNumber: '', sheba: '', holderName: '' }

function BankCardSkeleton({ index }: { index: number }) {
  return (
    <article
      className="admin-bank-card admin-bank-card--skeleton shop-rise"
      style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-bank-card__top admin-bank-card__top--skel">
        <div className="admin-bank-card__header">
          <span className="admin-bank-skel admin-bank-skel--bank" />
          <div className="admin-bank-card__actions">
            <span className="admin-bank-skel admin-bank-skel--btn" />
            <span className="admin-bank-skel admin-bank-skel--btn" />
            <span className="admin-bank-skel admin-bank-skel--btn" />
          </div>
        </div>
      </div>
      <div className="admin-bank-card__bottom">
        <div className="admin-bank-card__bottom-row">
          <div className="admin-bank-card__numbers">
            <span className="admin-bank-skel admin-bank-skel--number" />
            <span className="admin-bank-skel admin-bank-skel--sheba" />
          </div>
          <span className="admin-bank-skel admin-bank-skel--holder" />
        </div>
      </div>
    </article>
  )
}

export function AdminCardsPage() {
  const navigate = useNavigate()
  const { ready } = useAdminAccess()
  const { haptic } = useTelegram()
  const [cards, setCards] = useState<BankCard[]>([])
  const [version, setVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BankCard | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'success' })

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
  ) => setNotification({ show: true, message, type })

  const applyPayload = useCallback((payload: BankCardsPayload) => {
    setCards(payload.cards)
    setVersion(payload.version)
    writeLocalBankCards(payload)
  }, [])

  const refreshInBackground = useCallback(
    async (currentVersion?: string | null) => {
      try {
        const syncResult = await syncAdminBankCards(currentVersion)
        if (syncResult.changed) applyPayload(syncResult)
        else if (syncResult.version) setVersion(syncResult.version)
      } catch {
        // ignore background errors
      }
    },
    [applyPayload],
  )

  const load = useCallback(async () => {
    const localCache = readLocalBankCards('all')
    if (localCache) {
      applyPayload(localCache)
      setLoading(false)
      void refreshInBackground(localCache.version)
      return
    }

    setLoading(true)
    try {
      const payload = await fetchAdminBankCardsPayload()
      applyPayload(payload)
      void refreshInBackground(payload.version)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در دریافت کارت‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }, [applyPayload, refreshInBackground])

  const reloadAfterMutation = useCallback(async () => {
    try {
      const syncResult = await syncAdminBankCards(version)
      if (syncResult.changed) {
        applyPayload(syncResult)
        return
      }
      const payload = await fetchAdminBankCardsPayload()
      applyPayload(payload)
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در بروزرسانی لیست', 'error')
    }
  }, [applyPayload, version])

  useEffect(() => {
    preloadCardPatterns()
  }, [])

  useEffect(() => {
    if (!ready) return
    void load()
  }, [ready, load])

  useEffect(() => {
    if (!isTelegramWebApp()) return
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    const handleBack = () => navigate('/admin')
    backButton.show()
    backButton.onClick(handleBack)
    return () => {
      backButton.hide()
      backButton.offClick(handleBack)
    }
  }, [navigate])

  const openCreate = () => {
    haptic('light')
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (card: BankCard) => {
    setEditing(card)
    setForm({
      cardNumber: card.cardNumber,
      sheba: card.sheba ?? '',
      holderName: card.holderName,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        await updateAdminCard(editing.id, {
          cardNumber: form.cardNumber,
          sheba: form.sheba.trim() || null,
          holderName: form.holderName,
        })
        showNotification('کارت به‌روزرسانی شد')
      } else {
        await createAdminCard({
          cardNumber: form.cardNumber,
          sheba: form.sheba.trim() || null,
          holderName: form.holderName,
        })
        showNotification('کارت ذخیره شد')
      }
      setModalOpen(false)
      await reloadAfterMutation()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'ذخیره ناموفق بود', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (card: BankCard) => {
    haptic('light')
    try {
      await updateAdminCard(card.id, { isActive: !card.isActive })
      await reloadAfterMutation()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود', 'error')
    }
  }

  const handleDelete = async (card: BankCard) => {
    haptic('medium')
    try {
      await deleteAdminCard(card.id)
      showNotification('کارت حذف شد')
      await reloadAfterMutation()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'حذف ناموفق بود', 'error')
    }
  }

  if (!ready) return null

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader
          title="کارت‌های واریز"
          onBack={() => navigate('/admin')}
          action={
            <button
              type="button"
              className="page-header__action page-header__action--accent"
              onClick={openCreate}
            >
              افزودن کارت
            </button>
          }
        />
      </div>

      <p className="admin-section__hint shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        این کارت‌ها به کاربر برای واریز نشان داده می‌شوند
      </p>

      {loading ? (
        <div className="admin-bank-list" aria-busy="true" aria-label="در حال بارگذاری">
          {[0, 1, 2].map((index) => (
            <BankCardSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && cards.length === 0 ? (
        <p className="admin-empty">هنوز کارتی ثبت نشده است</p>
      ) : null}

      {!loading && cards.length > 0 ? (
      <div className="admin-bank-list">
        {cards.map((card, index) => {
          const visual = getBankVisual(null, card.cardNumber)
          const pattern = getCardPattern(card.id)

          return (
            <article
              key={card.id}
              className={`admin-bank-card shop-rise${card.isActive ? '' : ' admin-bank-card--inactive'}`}
              style={{ '--rise-index': Math.min(index + 2, 8) } as CSSProperties}
            >
              <div
                className="admin-bank-card__top"
                style={getCardTopBackgroundStyle(visual.color1, visual.color2, pattern)}
              >
                <div className="admin-bank-card__header">
                  <div className="admin-bank-card__bank">
                    <img
                      src={visual.iconSrc}
                      alt=""
                      width={20}
                      height={20}
                      onError={(event) => {
                        event.currentTarget.src = '/banks/unknown.svg'
                      }}
                    />
                    <span>{visual.nameFa}</span>
                  </div>

                  <div className="admin-bank-card__actions">
                    <button
                      type="button"
                      className="admin-bank-card__btn"
                      onClick={() => openEdit(card)}
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      className="admin-bank-card__btn"
                      onClick={() => void handleToggle(card)}
                    >
                      {card.isActive ? 'غیرفعال' : 'فعال'}
                    </button>
                    <button
                      type="button"
                      className="admin-bank-card__btn admin-bank-card__btn--danger"
                      onClick={() => void handleDelete(card)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-bank-card__bottom">
                <div className="admin-bank-card__bottom-row">
                  <div className="admin-bank-card__numbers">
                    <span className="admin-bank-card__number">
                      {formatCardNumberDisplay(card.cardNumber)}
                    </span>
                    {card.sheba ? (
                      <span className="admin-bank-card__sheba">
                        {formatShebaDisplay(card.sheba)}
                      </span>
                    ) : null}
                  </div>
                  <span className="admin-bank-card__holder">{card.holderName}</span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      ) : null}

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, show: false }))}
      />

      <CenterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'ویرایش کارت' : 'افزودن کارت'}
        description="شماره کارت الزامی است؛ شبا اختیاری است"
        buttons={[
          { label: 'لغو', onClick: () => setModalOpen(false) },
          {
            label: saving ? 'در حال ذخیره...' : 'ذخیره',
            onClick: () => void handleSave(),
            variant: 'primary',
            disabled: saving || !form.cardNumber.trim() || !form.holderName.trim(),
          },
        ]}
      >
        <div className="admin-modal-field">
          <label htmlFor="holderName">نام صاحب کارت</label>
          <input
            id="holderName"
            value={form.holderName}
            onChange={(e) => setForm((prev) => ({ ...prev, holderName: e.target.value }))}
            placeholder="مثلاً علیرضا میرحسینی"
            dir="rtl"
          />
        </div>
        <div className="admin-modal-field">
          <label htmlFor="cardNumber">شماره کارت</label>
          <input
            id="cardNumber"
            value={form.cardNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, cardNumber: e.target.value }))}
            placeholder="6037xxxxxxxxxxxx"
            inputMode="numeric"
            dir="ltr"
          />
        </div>
        <div className="admin-modal-field">
          <label htmlFor="sheba">شبا (اختیاری)</label>
          <input
            id="sheba"
            value={form.sheba}
            onChange={(e) => setForm((prev) => ({ ...prev, sheba: e.target.value }))}
            placeholder="IRxxxxxxxxxxxxxxxxxxxxxxxx"
            dir="ltr"
          />
        </div>
      </CenterModal>
    </div>
  )
}
