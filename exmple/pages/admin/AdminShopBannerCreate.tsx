import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { createAdminShopBanner } from '../../lib/adminApi'
import { clearLocalShopBanners } from '../../lib/shopBanners'
import { ACCOUNT_SHOP_PRODUCT_OPTIONS } from '../../data/accountShopProducts'
import { shopCategories } from '../../data/shopCategories'
import { AdminScreen } from './AdminScreen'
import './AdminShopBanners.css'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

type UploadPhase =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'converting'
  | 'success'
  | 'error'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('خواندن فایل ناموفق بود'))
    }
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'))
    reader.readAsDataURL(file)
  })
}

function toFaPercent(value: number) {
  return value.toLocaleString('fa-IR')
}

export function AdminShopBannerCreatePage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [title, setTitle] = useState('')
  const [productKey, setProductKey] = useState('')
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [thumbImage, setThumbImage] = useState<string | null>(null)
  const [mainPreview, setMainPreview] = useState<string | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [uploadPercent, setUploadPercent] = useState(0)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const busy = phase === 'preparing' || phase === 'uploading' || phase === 'converting'

  const handleBack = useCallback(() => {
    if (busy) return
    navigate('/admin/shop-banners', { replace: true })
  }, [busy, navigate])

  const buttonLabel = useMemo(() => {
    switch (phase) {
      case 'preparing':
        return 'آماده‌سازی تصاویر…'
      case 'uploading':
        return `در حال آپلود… ${toFaPercent(uploadPercent)}٪`
      case 'converting':
        return 'در حال تبدیل به webp و ذخیره…'
      case 'success':
        return 'بنر با موفقیت ساخته شد'
      case 'error':
        return 'تلاش مجدد'
      default:
        return 'آپلود و ساخت بنر'
    }
  }, [phase, uploadPercent])

  const handlePickImage = async (file: File | undefined, kind: 'main' | 'thumb') => {
    if (!file || busy) return
    if (!ACCEPTED_TYPES.has(file.type)) {
      setNotification({
        show: true,
        message: 'فقط تصویر jpg، png یا webp مجاز است',
        type: 'warning',
      })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotification({
        show: true,
        message: 'حجم تصویر نباید بیشتر از ۸ مگابایت باشد',
        type: 'warning',
      })
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (kind === 'main') {
        setMainImage(dataUrl)
        setMainPreview(dataUrl)
      } else {
        setThumbImage(dataUrl)
        setThumbPreview(dataUrl)
      }
      if (phase === 'error' || phase === 'success') setPhase('idle')
    } catch {
      setNotification({ show: true, message: 'خواندن تصویر ناموفق بود', type: 'error' })
    }
  }

  const handleCreate = async () => {
    if (busy) return

    if (!title.trim()) {
      setNotification({ show: true, message: 'عنوان بنر را وارد کنید', type: 'warning' })
      return
    }
    if (!productKey) {
      setNotification({ show: true, message: 'محصول را انتخاب کنید', type: 'warning' })
      return
    }
    if (!mainImage || !thumbImage) {
      setNotification({
        show: true,
        message: 'تصویر اصلی و تامبنیل را انتخاب کنید',
        type: 'warning',
      })
      return
    }

    setPhase('preparing')
    setUploadPercent(0)

    try {
      // brief prepare stage so the button status is visible before XHR starts
      await new Promise((resolve) => window.setTimeout(resolve, 180))
      setPhase('uploading')

      await createAdminShopBanner(
        {
          title: title.trim(),
          productKey,
          mainImage,
          thumbImage,
          isActive: true,
        },
        {
          onUploadProgress: (percent) => {
            setUploadPercent(percent)
            if (percent >= 100) {
              setPhase('converting')
            } else {
              setPhase('uploading')
            }
          },
        },
      )

      setUploadPercent(100)
      clearLocalShopBanners()
      haptic('medium')
      setPhase('success')
      setNotification({ show: true, message: 'بنر ساخته شد', type: 'success' })
      window.setTimeout(() => {
        navigate('/admin/shop-banners', { replace: true })
      }, 700)
    } catch (error) {
      setPhase('error')
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در ساخت بنر',
        type: 'error',
      })
    }
  }

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      title="افزودن بنر"
      eyebrow="بنر فروشگاه"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      <section className="admin__card admin-shop-banners__form">
        <label className="admin__field">
          <span className="admin__field-label">عنوان بنر</span>
          <input
            className="admin__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً تخفیف استارز"
            disabled={busy}
          />
        </label>

        <label className="admin__field">
          <span className="admin__field-label">محصول مرتبط</span>
          <select
            className="admin__select"
            value={productKey}
            onChange={(e) => setProductKey(e.target.value)}
            disabled={busy}
          >
            <option value="" disabled>
              انتخاب محصول
            </option>
            {shopCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
            {ACCOUNT_SHOP_PRODUCT_OPTIONS.map((item) => (
              <option key={item.productKey} value={item.productKey}>
                اکانت · {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-shop-banners__uploads">
          <label className={`admin-shop-banners__upload${busy ? ' is-disabled' : ''}`}>
            <span className="admin__field-label">تصویر اصلی</span>
            <span className="admin-shop-banners__hint">پیشنهاد: ۷۵۰×۲۸۰ یا ۱۱۲۵×۴۲۰</span>
            {mainPreview ? (
              <img
                src={mainPreview}
                alt=""
                className="admin-shop-banners__preview admin-shop-banners__preview--main"
              />
            ) : (
              <span className="admin-shop-banners__placeholder">انتخاب تصویر اصلی</span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => void handlePickImage(e.target.files?.[0], 'main')}
            />
          </label>

          <label className={`admin-shop-banners__upload${busy ? ' is-disabled' : ''}`}>
            <span className="admin__field-label">تصویر تامبنیل</span>
            <span className="admin-shop-banners__hint">پیشنهاد: ۱۳۴×۱۳۴ یا ۲۱۰×۲۱۰</span>
            {thumbPreview ? (
              <img
                src={thumbPreview}
                alt=""
                className="admin-shop-banners__preview admin-shop-banners__preview--thumb"
              />
            ) : (
              <span className="admin-shop-banners__placeholder admin-shop-banners__placeholder--thumb">
                انتخاب تامبنیل
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => void handlePickImage(e.target.files?.[0], 'thumb')}
            />
          </label>
        </div>

        <p className="admin-shop-banners__note">
          تصاویر jpg و png هنگام ساخت به webp تبدیل می‌شوند.
        </p>

        <button
          type="button"
          className={`admin__btn admin-shop-banners__submit${
            phase === 'success' ? ' is-success' : ''
          }${phase === 'error' ? ' is-error' : ''}`}
          disabled={busy || phase === 'success'}
          onClick={() => void handleCreate()}
        >
          <span className="admin-shop-banners__submit-label">{buttonLabel}</span>
          {(phase === 'uploading' || phase === 'converting') && (
            <span
              className="admin-shop-banners__submit-bar"
              style={{
                width: `${phase === 'converting' ? 100 : uploadPercent}%`,
              }}
            />
          )}
        </button>
      </section>
    </AdminScreen>
  )
}
