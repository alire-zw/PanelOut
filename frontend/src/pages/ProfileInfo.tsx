import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { CenterModal } from '../components/CenterModal'
import { PageHeader } from '../components/PageHeader'
import { Notification } from '../components/Notification'
import EmailIcon from '../components/icons/EmailIcon'
import IdIcon from '../components/icons/IdIcon'
import { useEnsureUser } from '../hooks/useEnsureUser'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import './ProfileInfo.css'

type NotificationType = 'success' | 'error' | 'warning' | 'info'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function ProfileInfoPage() {
  const navigate = useNavigate()
  const { user, isLoading, error, updateProfile } = useEnsureUser()

  const [realName, setRealName] = useState('')
  const [email, setEmail] = useState('')
  const [isFullNameModalOpen, setIsFullNameModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [tempFullName, setTempFullName] = useState('')
  const [tempEmail, setTempEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: NotificationType
  }>({
    show: false,
    message: '',
    type: 'success',
  })

  useEffect(() => {
    if (!user) return
    setRealName(user.realName ?? '')
    setEmail(user.email ?? '')
  }, [user])

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

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const handleSaveFullName = async () => {
    if (!tempFullName.trim()) {
      showNotification('لطفاً نام کامل خود را وارد کنید', 'error')
      return
    }

    setIsSaving(true)
    try {
      const next = await updateProfile({ realName: tempFullName.trim() })
      setRealName(next.realName ?? tempFullName.trim())
      setIsFullNameModalOpen(false)
      showNotification('نام کامل با موفقیت به‌روزرسانی شد')
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'خطا در به‌روزرسانی نام کامل', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveEmail = async () => {
    if (!tempEmail.trim()) {
      showNotification('لطفاً ایمیل خود را وارد کنید', 'error')
      return
    }

    if (!isValidEmail(tempEmail)) {
      showNotification('لطفاً یک ایمیل معتبر وارد کنید', 'error')
      return
    }

    setIsSaving(true)
    try {
      const next = await updateProfile({ email: tempEmail.trim() })
      setEmail(next.email ?? tempEmail.trim())
      setIsEmailModalOpen(false)
      showNotification('ایمیل با موفقیت به‌روزرسانی شد')
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'خطا در به‌روزرسانی ایمیل', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const canEdit = Boolean(user) && !isLoading

  return (
    <div className="profile-info">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="اطلاعات حساب" onBack={() => navigate(-1)} />
      </div>

      <div className="profile-info__content">
        <h3
          className="profile-info__section-title shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
        >
          اطلاعات پروفایل
        </h3>

        {error && !user ? (
          <p
            className="profile-info__status profile-info__status--error shop-rise"
            style={{ '--rise-index': 2 } as CSSProperties}
          >
            {error}
          </p>
        ) : null}

        <div
          className="profile-info__items shop-rise"
          style={{ '--rise-index': 2 } as CSSProperties}
        >
          <div className="profile-info__item">
            <div className="profile-info__item-start">
              <span className="profile-info__icon">
                <IdIcon width={18} height={18} />
              </span>
              <div>
                <div className="profile-info__label">نام کامل</div>
                <div className="profile-info__value">
                  {isLoading && !user ? '...' : realName || '--'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="profile-info__edit-btn"
              disabled={!canEdit}
              onClick={() => {
                setTempFullName(realName)
                setIsFullNameModalOpen(true)
              }}
            >
              {realName ? 'ویرایش' : 'افزودن'}
            </button>
          </div>

          <div className="profile-info__divider" />

          <div className="profile-info__item">
            <div className="profile-info__item-start">
              <span className="profile-info__icon">
                <EmailIcon width={18} height={18} />
              </span>
              <div>
                <div className="profile-info__label">ایمیل</div>
                <div className="profile-info__value">
                  {isLoading && !user ? '...' : email || '--'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="profile-info__edit-btn"
              disabled={!canEdit}
              onClick={() => {
                setTempEmail(email)
                setIsEmailModalOpen(true)
              }}
            >
              {email ? 'ویرایش' : 'افزودن'}
            </button>
          </div>
        </div>
      </div>

      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />

      <CenterModal
        isOpen={isFullNameModalOpen}
        onClose={() => setIsFullNameModalOpen(false)}
        title={realName ? 'ویرایش نام کامل' : 'افزودن نام کامل'}
        description="نام کامل خود را وارد کنید"
        buttons={[
          { label: 'لغو', onClick: () => setIsFullNameModalOpen(false) },
          {
            label: isSaving ? 'در حال ذخیره...' : 'ذخیره',
            onClick: () => void handleSaveFullName(),
            variant: 'primary',
            disabled: isSaving || !tempFullName.trim(),
          },
        ]}
      >
        <div className="profile-info__modal-field">
          <input
            type="text"
            value={tempFullName}
            onChange={(event) => setTempFullName(event.target.value)}
            className="profile-info__input"
            placeholder="نام کامل"
            dir="rtl"
            maxLength={80}
            disabled={isSaving}
          />
          <span className="profile-info__input-icon">
            <IdIcon width={16} height={16} />
          </span>
        </div>
      </CenterModal>

      <CenterModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        title={email ? 'ویرایش ایمیل' : 'افزودن ایمیل'}
        description="ایمیل خود را وارد کنید"
        buttons={[
          { label: 'لغو', onClick: () => setIsEmailModalOpen(false) },
          {
            label: isSaving ? 'در حال ذخیره...' : 'ذخیره',
            onClick: () => void handleSaveEmail(),
            variant: 'primary',
            disabled: isSaving || !tempEmail.trim() || !isValidEmail(tempEmail),
          },
        ]}
      >
        <div className="profile-info__modal-field">
          <input
            type="email"
            value={tempEmail}
            onChange={(event) => setTempEmail(event.target.value)}
            className="profile-info__input"
            placeholder="example@email.com"
            maxLength={120}
            disabled={isSaving}
          />
          <span className="profile-info__input-icon">
            <EmailIcon width={16} height={16} />
          </span>
        </div>
      </CenterModal>
    </div>
  )
}
