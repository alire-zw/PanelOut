import { useCallback, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../../data/accountShopCategories'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import { AdminScreen } from './AdminScreen'
import '../../styles/shop-rise.css'
import './AdminAccountPlans.css'

export function AdminAccountPlansPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()

  const handleBack = useCallback(() => navigate('/admin', { replace: true }), [navigate])

  if (!ready || !allowed) return null

  return (
    <AdminScreen sticky title="پلن‌های اکانت" onBack={handleBack}>
      <p className="admin-account-plans__intro shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        دسته را انتخاب کنید؛ پلن‌ها را با کاتالوگ تأمین‌کننده بسازید و برای فروشگاه آماده کنید.
      </p>
      <div className="admin-account-plans__cats shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
        {ACCOUNT_SHOP_CATEGORY_OPTIONS.map((category) => (
          <button
            key={category.id}
            type="button"
            className="admin-account-plans__cat"
            onClick={() => {
              haptic('light')
              navigate(`/admin/account-plans/${category.id}`)
            }}
          >
            <span className="admin-account-plans__cat-icon" aria-hidden>
              {category.stillImageSrc || category.imageSrc ? (
                <img
                  src={category.stillImageSrc ?? category.imageSrc ?? ''}
                  alt=""
                  width={24}
                  height={24}
                />
              ) : (
                category.label.charAt(0)
              )}
            </span>
            <span className="admin-account-plans__cat-copy">
              <strong>{category.label}</strong>
              <span>{category.shortDesc}</span>
            </span>
          </button>
        ))}
      </div>
    </AdminScreen>
  )
}
