import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { shopCategories } from '../../data/shopCategories'
import {
  ACCOUNT_SHOP_PRODUCT_OPTIONS,
  parseAccountShopProductKey,
} from '../../data/accountShopProducts'
import ChatGPTIcon from '../../components/icons/ChatGPTIcon'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  fetchAdminPricing,
  fetchAdminPricingCatalog,
  upsertAdminPricing,
  type AdminPricingCatalog,
  type AdminPricingItem,
} from '../../lib/adminApi'
import {
  applyPricingRule,
  invalidateShopPricingCache,
} from '../../lib/productPricing'
import { EmptyState } from '../../components/EmptyState'
import { formatFaNumber } from './adminLabels'
import { AdminScreen } from './AdminScreen'

function ArrowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m15 18-6-6 6-6"
      />
    </svg>
  )
}

function shopMeta(productKey: string) {
  const shop = shopCategories.find((item) => item.id === productKey)
  if (shop) return { ...shop, imageSrc: null as string | null }

  const accountId = parseAccountShopProductKey(productKey)
  if (!accountId) return null
  const account = ACCOUNT_SHOP_PRODUCT_OPTIONS.find((item) => item.categoryId === accountId)
  if (!account) return null
  return {
    id: productKey,
    label: account.label,
    icon: ChatGPTIcon,
    gradient: 'linear-gradient(135deg, #10a37f 0%, #1a7f64 100%)',
    iconColor: '#ffffff',
    isActive: true,
    imageSrc: account.imageSrc,
  }
}

export function AdminPricingPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()
  const [items, setItems] = useState<AdminPricingItem[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [markup, setMarkup] = useState('0')
  const [fixed, setFixed] = useState('0')
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalog, setCatalog] = useState<AdminPricingCatalog | null>(null)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const selected = useMemo(
    () => items.find((item) => item.productKey === selectedKey) ?? null,
    [items, selectedKey],
  )

  const selectedShop = selectedKey ? shopMeta(selectedKey) : null
  const SelectedIcon = selectedShop?.icon

  const draftRule = useMemo(
    () => ({
      productKey: selectedKey ?? '',
      markupPercent: Number(markup) || 0,
      fixedAddToman: Number(fixed) || 0,
    }),
    [fixed, markup, selectedKey],
  )

  const previewItems = useMemo(() => {
    if (!catalog?.items.length) return []
    return catalog.items.map((item) => ({
      ...item,
      previewFinal: applyPricingRule(item.baseToman, draftRule),
    }))
  }, [catalog, draftRule])

  const groupedPreview = useMemo(() => {
    const groups = new Map<string, typeof previewItems>()
    for (const item of previewItems) {
      const key = item.group?.trim() || ''
      const list = groups.get(key) ?? []
      list.push(item)
      groups.set(key, list)
    }
    return [...groups.entries()]
  }, [previewItems])

  const handleBack = useCallback(() => {
    if (selectedKey) {
      setSelectedKey(null)
      setCatalog(null)
      return
    }
    navigate('/admin', { replace: true })
  }, [navigate, selectedKey])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchAdminPricing()
      setItems(result.items)
      if (selectedKey) {
        const current = result.items.find((item) => item.productKey === selectedKey)
        if (current) {
          setMarkup(String(current.markupPercent))
          setFixed(String(Number(current.fixedAddToman) || 0))
        }
      }
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت قیمت‌گذاری',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedKey])

  const loadCatalog = useCallback(async (productKey: string) => {
    setCatalogLoading(true)
    setCatalog(null)
    try {
      const result = await fetchAdminPricingCatalog(productKey)
      setCatalog(result)
      if (result.note && result.items.length === 0) {
        setNotification({
          show: true,
          message: result.note,
          type: 'warning',
        })
      }
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در دریافت قیمت وب‌سرویس',
        type: 'error',
      })
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !allowed) return
    void load()
  }, [allowed, load, ready])

  const openProduct = (item: AdminPricingItem) => {
    haptic('light')
    setSelectedKey(item.productKey)
    setMarkup(String(item.markupPercent))
    setFixed(String(Number(item.fixedAddToman) || 0))
    void loadCatalog(item.productKey)
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await upsertAdminPricing({
        productKey: selected.productKey,
        label: selected.label,
        markupPercent: Number(markup) || 0,
        fixedAddToman: Number(fixed) || 0,
        isActive: true,
      })
      invalidateShopPricingCache()
      haptic('medium')
      setNotification({
        show: true,
        message: `قیمت‌گذاری «${selected.label}» ذخیره شد`,
        type: 'success',
      })
      await Promise.all([load(), loadCatalog(selected.productKey)])
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'خطا در ذخیره',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!ready || !allowed) return null

  return (
    <AdminScreen
      sticky={!selected}
      title={selected ? selected.label : 'قیمت‌گذاری محصولات'}
      eyebrow="بازار"
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      {!selected ? (
        <>
          <p className="admin-price__intro">
            محصول را انتخاب کنید. قیمت پایه از وب‌سرویس همان محصول خوانده می‌شود؛ درصد و مبلغ ثابت روی
            همه آیتم‌ها اعمال و رند می‌شود.
          </p>
          {loading ? (
            <p className="admin__muted">در حال بارگذاری…</p>
          ) : (
            <div className="admin-price__list shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
              {items.map((item) => {
                const meta = shopMeta(item.productKey)
                const Icon = meta?.icon
                return (
                  <button
                    key={item.productKey}
                    type="button"
                    className="admin-price__pick"
                    onClick={() => openProduct(item)}
                  >
                    <span
                      className="admin-price__pick-icon"
                      style={{ background: meta?.gradient ?? 'var(--surface)' }}
                    >
                      {meta?.imageSrc ? (
                        <img src={meta.imageSrc} alt="" width={22} height={22} />
                      ) : Icon ? (
                        <Icon width={22} height={22} color={meta?.iconColor ?? '#ffffff'} />
                      ) : null}
                    </span>
                    <span className="admin-price__pick-copy">
                      <span className="admin-price__pick-title">{item.label}</span>
                      <span className="admin-price__pick-meta">
                        {item.markupPercent
                          ? `${formatFaNumber(item.markupPercent)}٪`
                          : 'بدون درصد'}
                        {Number(item.fixedAddToman) > 0
                          ? ` · +${formatFaNumber(Number(item.fixedAddToman))} تومان`
                          : ''}
                      </span>
                    </span>
                    <span className="admin-price__pick-arrow">
                      <ArrowIcon />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <section className="admin-price__editor shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
          <div className="admin-price__context">
            <span
              className="admin-price__context-icon"
              style={{ background: selectedShop?.gradient ?? 'var(--surface)' }}
            >
              {selectedShop?.imageSrc ? (
                <img src={selectedShop.imageSrc} alt="" width={26} height={26} />
              ) : SelectedIcon ? (
                <SelectedIcon
                  width={26}
                  height={26}
                  color={selectedShop?.iconColor ?? '#ffffff'}
                />
              ) : null}
            </span>
            <span className="admin-price__context-copy">
              <span className="admin-price__context-label">محصول انتخاب‌شده</span>
              <strong className="admin-price__context-title">{selected.label}</strong>
              {catalog?.source ? (
                <span className="admin-price__context-source">منبع: {catalog.source}</span>
              ) : null}
            </span>
          </div>

          <label className="admin-price__field">
            <span className="admin-price__field-label">درصد افزایش قیمت</span>
            <div className="admin-price__field-row">
              <input
                className="admin-price__input"
                value={markup}
                onChange={(event) => setMarkup(event.target.value.replace(/[^\d-]/g, ''))}
                inputMode="numeric"
                placeholder="۰"
              />
              <span className="admin-price__suffix">٪</span>
            </div>
            <span className="admin-price__hint">مثلاً ۱۰ یعنی ۱۰٪ به قیمت پایه هر آیتم اضافه شود</span>
          </label>

          <label className="admin-price__field">
            <span className="admin-price__field-label">مبلغ ثابت اضافه</span>
            <div className="admin-price__field-row">
              <input
                className="admin-price__input"
                value={fixed}
                onChange={(event) => setFixed(event.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="۰"
              />
              <span className="admin-price__suffix">تومان</span>
            </div>
            <span className="admin-price__hint">بعد از درصد، این مبلغ ثابت هم به هر آیتم اضافه می‌شود</span>
          </label>

          <button
            type="button"
            className="admin__btn"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'در حال ذخیره…' : 'ذخیره قیمت‌گذاری'}
          </button>

          <div className="admin-price__catalog">
            <div className="admin-price__catalog-head">
              <strong>جزئیات قیمت از وب‌سرویس</strong>
              {catalog?.sampleHint ? <span>{catalog.sampleHint}</span> : null}
            </div>

            {catalogLoading ? (
              <p className="admin-price__catalog-empty">در حال دریافت قیمت‌ها…</p>
            ) : catalog?.note && previewItems.length === 0 ? (
              <p className="admin-price__catalog-empty">{catalog.note}</p>
            ) : previewItems.length === 0 ? (
              <EmptyState compact title="آیتمی برای نمایش نیست" />
            ) : (
              groupedPreview.map(([group, groupItems]) => (
                <div key={group || 'default'} className="admin-price__catalog-group">
                  {group ? <h3 className="admin-price__catalog-group-title">{group}</h3> : null}
                  <div className="admin-price__catalog-list">
                    {groupItems.map((item) => (
                      <div key={item.id} className="admin-price__catalog-row">
                        <div className="admin-price__catalog-copy">
                          <span className="admin-price__catalog-title">{item.label}</span>
                          {item.subtitle ? (
                            <span className="admin-price__catalog-sub">{item.subtitle}</span>
                          ) : null}
                        </div>
                        <div className="admin-price__catalog-prices">
                          <span className="admin-price__catalog-base">
                            پایه {formatFaNumber(Math.round(item.baseToman))}
                          </span>
                          <strong className="admin-price__catalog-final">
                            {formatFaNumber(item.previewFinal)} تومان
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            {catalog?.note && previewItems.length > 0 ? (
              <p className="admin-price__catalog-note">{catalog.note}</p>
            ) : null}
          </div>
        </section>
      )}
      <div style={{ height: 20 }} />
    </AdminScreen>
  )
}
