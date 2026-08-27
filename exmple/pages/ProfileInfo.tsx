import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { CenterModal } from '../components/CenterModal'
import { PageHeader } from '../components/PageHeader'
import { Notification } from '../components/Notification'
import EmailIcon from '../components/icons/EmailIcon'
import IdIcon from '../components/icons/IdIcon'
import PhoneIcon from '../components/icons/PhoneIcon'
import { useUser } from '../context/UserContext'
import { updateCurrentUser, isTelegramWebApp } from '../lib/api'
import { sendKycPhoneOtp, verifyKycPhoneOtp } from '../lib/kycApi'
import {
  formatCountdownFa,
  formatPhoneFa,
  isValidIrMobile,
  OTP_CODE_LENGTH,
} from '../lib/phone'
import '../styles/shop-rise.css'
import './ProfileInfo.css'

type NotificationType = 'success' | 'error' | 'warning' | 'info'
type MobileModalStep = 'phone' | 'otp'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function normalizePhoneDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '')
    .slice(0, 11)
}

function normalizeOtpDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '')
    .slice(0, OTP_CODE_LENGTH)
}

export function ProfileInfoPage() {
  const navigate = useNavigate()
  const { user, refetch } = useUser()

  const [realName, setRealName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [isFullNameModalOpen, setIsFullNameModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false)
  const [mobileStep, setMobileStep] = useState<MobileModalStep>('phone')
  const [tempFullName, setTempFullName] = useState('')
  const [tempEmail, setTempEmail] = useState('')
  const [tempMobile, setTempMobile] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isResendingOtp, setIsResendingOtp] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    message: '',
    type: 'success',
  })

  const hasRegisteredPhone = Boolean(mobile)

  useEffect(() => {
    if (!user) return
    setRealName(user.realName ?? '')
    setEmail(user.email ?? '')
    setMobile(user.phoneNumber ?? '')
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

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ show: true, message, type })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }

  const resetMobileModal = () => {
    setIsMobileModalOpen(false)
    setMobileStep('phone')
    setTempMobile('')
    setOtpCode('')
    setResendSeconds(0)
    setIsSendingOtp(false)
    setIsVerifyingOtp(false)
    setIsResendingOtp(false)
  }

  const handleOpenMobileModal = () => {
    if (hasRegisteredPhone) return
    setTempMobile('')
    setOtpCode('')
    setMobileStep('phone')
    setResendSeconds(0)
    setIsMobileModalOpen(true)
  }

  const handleSaveFullName = async () => {
    if (!tempFullName.trim()) {
      showNotification('لطفاً نام کامل خود را وارد کنید', 'error')
      return
    }

    setIsSaving(true)
    try {
      await updateCurrentUser({ realName: tempFullName.trim() })
      setRealName(tempFullName.trim())
      setIsFullNameModalOpen(false)
      showNotification('نام کامل با موفقیت به‌روزرسانی شد')
      await refetch()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در به‌روزرسانی نام کامل', 'error')
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
      await updateCurrentUser({ email: tempEmail.trim() })
      setEmail(tempEmail.trim())
      setIsEmailModalOpen(false)
      showNotification('ایمیل با موفقیت به‌روزرسانی شد')
      await refetch()
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'خطا در به‌روزرسانی ایمیل', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendMobileOtp = async () => {
    const phoneDigits = normalizePhoneDigits(tempMobile)
    if (!isValidIrMobile(phoneDigits)) {
      showNotification('لطفاً یک شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)', 'error')
      return
    }

    setIsSendingOtp(true)
    try {
      const result = await sendKycPhoneOtp(phoneDigits)
      setTempMobile(phoneDigits)
      setOtpCode('')
      setResendSeconds(result.resendAvailableInSeconds)
      setMobileStep('otp')
      if (result.alreadySent) {
        showNotification('کد قبلاً برای شما ارسال شده است', 'info')
      } else {
        showNotification('کد تأیید ارسال شد', 'success')
      }
    } catch (error) {
      const retryAfter =
        error && typeof error === 'object' && 'retryAfterSeconds' in error
          ? Number((error as { retryAfterSeconds?: number }).retryAfterSeconds)
          : NaN
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setResendSeconds(retryAfter)
      }
      showNotification(error instanceof Error ? error.message : 'ارسال کد ناموفق بود', 'error')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleResendMobileOtp = async () => {
    if (!isValidIrMobile(tempMobile) || resendSeconds > 0 || isResendingOtp) return

    setIsResendingOtp(true)
    try {
      const result = await sendKycPhoneOtp(tempMobile)
      setResendSeconds(result.resendAvailableInSeconds)
      setOtpCode('')
      showNotification('کد جدید ارسال شد', 'success')
    } catch (error) {
      const retryAfter =
        error && typeof error === 'object' && 'retryAfterSeconds' in error
          ? Number((error as { retryAfterSeconds?: number }).retryAfterSeconds)
          : NaN
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setResendSeconds(retryAfter)
      }
      showNotification(error instanceof Error ? error.message : 'ارسال مجدد ناموفق بود', 'error')
    } finally {
      setIsResendingOtp(false)
    }
  }

  const handleVerifyMobileOtp = async () => {
    const code = normalizeOtpDigits(otpCode)
    if (!isValidIrMobile(tempMobile) || code.length !== OTP_CODE_LENGTH) {
      showNotification('کد تأیید را کامل وارد کنید', 'error')
      return
    }

    setIsVerifyingOtp(true)
    try {
      await verifyKycPhoneOtp(tempMobile, code)
      setMobile(tempMobile)
      resetMobileModal()
      showNotification('شماره موبایل با موفقیت تأیید و ثبت شد', 'success')
      await refetch()
    } catch (error) {
      setOtpCode('')
      showNotification(error instanceof Error ? error.message : 'تأیید کد ناموفق بود', 'error')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

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
                <div className="profile-info__value">{realName || '--'}</div>
              </div>
            </div>
            <button
              type="button"
              className="profile-info__edit-btn"
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
                <PhoneIcon width={18} height={18} />
              </span>
              <div>
                <div className="profile-info__label">شماره موبایل</div>
                <div className="profile-info__value profile-info__value--phone">
                  {mobile ? formatPhoneFa(mobile) : '--'}
                </div>
              </div>
            </div>
            {hasRegisteredPhone ? (
              <span className="profile-info__locked">ثبت‌شده</span>
            ) : (
              <button type="button" className="profile-info__edit-btn" onClick={handleOpenMobileModal}>
                افزودن
              </button>
            )}
          </div>

          <div className="profile-info__divider" />

          <div className="profile-info__item">
            <div className="profile-info__item-start">
              <span className="profile-info__icon">
                <EmailIcon width={18} height={18} />
              </span>
              <div>
                <div className="profile-info__label">ایمیل</div>
                <div className="profile-info__value">{email || '--'}</div>
              </div>
            </div>
            <button
              type="button"
              className="profile-info__edit-btn"
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
            label: 'ذخیره',
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
            label: 'ذخیره',
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
          />
          <span className="profile-info__input-icon">
            <EmailIcon width={16} height={16} />
          </span>
        </div>
      </CenterModal>

      <CenterModal
        isOpen={isMobileModalOpen}
        onClose={resetMobileModal}
        title={mobileStep === 'phone' ? 'افزودن شماره موبایل' : 'تأیید شماره موبایل'}
        description={
          mobileStep === 'phone'
            ? 'شماره موبایل خود را وارد کنید تا کد تأیید پیامک شود.'
            : `کد ارسال‌شده به ${formatPhoneFa(tempMobile)} را وارد کنید.`
        }
        buttons={
          mobileStep === 'phone'
            ? [
                { label: 'لغو', onClick: resetMobileModal },
                {
                  label: isSendingOtp ? 'در حال ارسال...' : 'ارسال کد',
                  onClick: () => void handleSendMobileOtp(),
                  variant: 'primary',
                  disabled: isSendingOtp || !isValidIrMobile(tempMobile),
                },
              ]
            : [
                {
                  label: 'تغییر شماره',
                  onClick: () => {
                    setMobileStep('phone')
                    setOtpCode('')
                  },
                },
                {
                  label: isVerifyingOtp ? 'در حال تأیید...' : 'تأیید و ثبت',
                  onClick: () => void handleVerifyMobileOtp(),
                  variant: 'primary',
                  disabled: isVerifyingOtp || otpCode.length !== OTP_CODE_LENGTH,
                },
              ]
        }
      >
        {mobileStep === 'phone' ? (
          <div className="profile-info__modal-field">
            <input
              type="tel"
              value={tempMobile ? formatPhoneFa(tempMobile) : ''}
              onChange={(event) => {
                setTempMobile(normalizePhoneDigits(event.target.value))
              }}
              className="profile-info__input profile-info__input--phone"
              placeholder={formatPhoneFa('09123456789')}
              maxLength={11}
              inputMode="numeric"
              autoFocus
            />
            <span className="profile-info__input-icon">
              <PhoneIcon width={16} height={16} />
            </span>
          </div>
        ) : (
          <div className="profile-info__otp">
            <div className="profile-info__modal-field">
              <input
                type="tel"
                value={otpCode ? formatPhoneFa(otpCode) : ''}
                onChange={(event) => {
                  setOtpCode(normalizeOtpDigits(event.target.value))
                }}
                className="profile-info__input profile-info__input--phone"
                placeholder={formatPhoneFa('0'.repeat(OTP_CODE_LENGTH))}
                maxLength={OTP_CODE_LENGTH}
                inputMode="numeric"
                autoFocus
              />
            </div>
            <button
              type="button"
              className="profile-info__resend"
              onClick={() => void handleResendMobileOtp()}
              disabled={resendSeconds > 0 || isResendingOtp}
            >
              {resendSeconds > 0
                ? `ارسال مجدد تا ${formatCountdownFa(resendSeconds)}`
                : isResendingOtp
                  ? 'در حال ارسال...'
                  : 'ارسال مجدد کد'}
            </button>
          </div>
        )}
      </CenterModal>
    </div>
  )
}
