import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CursorAddSelection01Icon from '../../components/icons/cursor-add-selection-01-stroke-rounded'
import CursorRemoveSelection01Icon from '../../components/icons/cursor-remove-selection-01-stroke-rounded'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../../data/accountShopCategories'
import { isAccountShopCategoryId } from '../../data/accountShopProducts'
import { useAdminAccess } from '../../hooks/useAdminAccess'
import { useTelegram } from '../../hooks/useTelegram'
import {
  createAdminAccountPlan,
  fetchAdminAccountPlan,
  fetchAdminRoboticvnProduct,
  fetchAdminRoboticvnProducts,
  updateAdminAccountPlan,
  type AccountShopNoticeKind,
  type AccountShopPricingMode,
  type AccountShopWarrantyType,
  type AdminAccountShopCustomField,
  type RoboticvnProductDetail,
  type RoboticvnProductSummary,
  type RoboticvnProductVariant,
} from '../../lib/adminApi'
import { AdminScreen } from './AdminScreen'
import '../../styles/shop-rise.css'
import './AdminAccountPlans.css'

function formatWarrantyPreview(
  warrantyType: AccountShopWarrantyType,
  warrantyDays: number | null,
): string {
  if (warrantyType === 'full') return 'گارانتی کامل'
  if (warrantyType === 'none') return 'بدون گارانتی'
  const days = warrantyDays ?? 0
  if (days <= 0) return 'بدون گارانتی'
  if (days === 7) return 'یک هفته گارانتی'
  if (days === 30) return 'یک ماه گارانتی'
  return `${days.toLocaleString('fa-IR')} روز گارانتی`
}

function newFieldId() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function noticeKindLabel(kind: AccountShopNoticeKind) {
  if (kind === 'info') return 'اطلاعات'
  if (kind === 'warning') return 'هشدار'
  if (kind === 'note') return 'نکته'
  return 'بدون پیام'
}

export function AdminAccountPlansCreatePage() {
  const navigate = useNavigate()
  const { categoryId: categoryIdParam, planId: planIdParam } = useParams<{
    categoryId: string
    planId?: string
  }>()
  const { haptic } = useTelegram()
  const { ready, allowed } = useAdminAccess()

  const categoryId =
    categoryIdParam && isAccountShopCategoryId(categoryIdParam) ? categoryIdParam : null
  const category =
    ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId) ?? null
  const editPlanId = planIdParam ? Number.parseInt(planIdParam, 10) : null
  const isEdit = editPlanId != null && Number.isFinite(editPlanId)

  const productSelectRef = useRef<HTMLDivElement>(null)
  const variantSelectRef = useRef<HTMLDivElement>(null)

  const [loadingPlan, setLoadingPlan] = useState(isEdit)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [products, setProducts] = useState<RoboticvnProductSummary[]>([])
  const [isProductOpen, setIsProductOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [productDetail, setProductDetail] = useState<RoboticvnProductDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [productTitleSnapshot, setProductTitleSnapshot] = useState<string | null>(null)

  const [isVariantOpen, setIsVariantOpen] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<RoboticvnProductVariant | null>(null)

  const [name, setName] = useState('')
  const [durationLabel, setDurationLabel] = useState('۱ ماه')
  const [warrantyType, setWarrantyType] = useState<AccountShopWarrantyType>('days')
  const [warrantyDays, setWarrantyDays] = useState('7')
  const [pricingMode, setPricingMode] = useState<AccountShopPricingMode>('variable')
  const [fixedToman, setFixedToman] = useState('')
  const [markupPercent, setMarkupPercent] = useState('0')
  const [customFields, setCustomFields] = useState<AdminAccountShopCustomField[]>([])
  const [noticeKind, setNoticeKind] = useState<AccountShopNoticeKind>('none')
  const [noticeText, setNoticeText] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ show: false, message: '', type: 'error' })

  const handleBack = useCallback(() => {
    if (!categoryId) {
      navigate('/admin/account-plans', { replace: true })
      return
    }
    navigate(`/admin/account-plans/${categoryId}`, { replace: true })
  }, [categoryId, navigate])

  useEffect(() => {
    if (!categoryId) {
      navigate('/admin/account-plans', { replace: true })
    }
  }, [categoryId, navigate])

  const warrantyPreview = useMemo(() => {
    const days = warrantyType === 'days' ? Number.parseInt(warrantyDays, 10) : null
    return formatWarrantyPreview(warrantyType, Number.isFinite(days) ? days : null)
  }, [warrantyDays, warrantyType])

  const selectedProductTitle =
    productDetail?.title ??
    productTitleSnapshot ??
    products.find((item) => item.id === selectedProductId)?.title ??
    null

  const runSearch = useCallback(async (term: string) => {
    setSearching(true)
    try {
      const result = await fetchAdminRoboticvnProducts(term)
      setProducts(result.data ?? [])
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'جستجوی محصول ناموفق بود',
        type: 'error',
      })
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!ready || !allowed) return
    void runSearch('')
  }, [allowed, ready, runSearch])

  useEffect(() => {
    if (!isEdit || !editPlanId || !categoryId || !ready || !allowed) return
    let cancelled = false
    setLoadingPlan(true)
    void (async () => {
      try {
        const { plan } = await fetchAdminAccountPlan(editPlanId)
        if (cancelled) return
        if (plan.categoryId !== categoryId) {
          navigate(`/admin/account-plans/${plan.categoryId}/edit/${plan.id}`, { replace: true })
          return
        }
        setName(plan.name)
        setDurationLabel(plan.durationLabel)
        setWarrantyType(plan.warrantyType)
        setWarrantyDays(
          plan.warrantyType === 'days' ? String(plan.warrantyDays ?? 0) : '7',
        )
        setPricingMode(plan.pricingMode)
        setFixedToman(plan.fixedToman != null ? String(plan.fixedToman) : '')
        setMarkupPercent(String(plan.markupPercent ?? 0))
        setCustomFields(plan.customFields)
        setNoticeKind(plan.noticeKind)
        setNoticeText(plan.noticeText ?? '')
        setIsActive(plan.isActive)
        setSelectedProductId(plan.roboticvnProductId)
        setProductTitleSnapshot(plan.roboticvnVariantTitle)
        setSelectedVariant({
          id: plan.roboticvnVariantId,
          title: plan.roboticvnVariantTitle,
          prices: {},
          in_stock: true,
          available_quantity: 0,
        })
        setLoadingDetail(true)
        try {
          const detail = await fetchAdminRoboticvnProduct(plan.roboticvnProductId)
          if (cancelled) return
          setProductDetail(detail.data)
          setProductTitleSnapshot(detail.data.title)
          const match =
            detail.data.variants.find((item) => item.id === plan.roboticvnVariantId) ?? null
          if (match) setSelectedVariant(match)
        } catch {
          // keep snapshot variant if supplier catalog is unavailable
        } finally {
          if (!cancelled) setLoadingDetail(false)
        }
      } catch (error) {
        if (cancelled) return
        setNotification({
          show: true,
          message: error instanceof Error ? error.message : 'دریافت پلن ناموفق بود',
          type: 'error',
        })
        navigate(`/admin/account-plans/${categoryId}`, { replace: true })
      } finally {
        if (!cancelled) setLoadingPlan(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed, categoryId, editPlanId, isEdit, navigate, ready])

  useEffect(() => {
    if (!isProductOpen && !isVariantOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (isProductOpen && productSelectRef.current && !productSelectRef.current.contains(target)) {
        setIsProductOpen(false)
      }
      if (isVariantOpen && variantSelectRef.current && !variantSelectRef.current.contains(target)) {
        setIsVariantOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isProductOpen, isVariantOpen])

  const selectProduct = async (productId: string) => {
    haptic('light')
    setSelectedProductId(productId)
    setSelectedVariant(null)
    setProductDetail(null)
    setProductTitleSnapshot(null)
    setIsProductOpen(false)
    setIsVariantOpen(false)
    setLoadingDetail(true)
    try {
      const result = await fetchAdminRoboticvnProduct(productId)
      setProductDetail(result.data)
      setProductTitleSnapshot(result.data.title)
      if (!name.trim()) setName(result.data.title)
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'دریافت جزئیات محصول ناموفق بود',
        type: 'error',
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  const clearProduct = () => {
    haptic('light')
    setSelectedProductId(null)
    setProductDetail(null)
    setProductTitleSnapshot(null)
    setSelectedVariant(null)
    setIsProductOpen(false)
    setIsVariantOpen(false)
  }

  const selectVariant = (variant: RoboticvnProductVariant) => {
    haptic('light')
    setSelectedVariant(variant)
    setIsVariantOpen(false)
  }

  const handleSave = async () => {
    if (!categoryId || saving) return

    if (!selectedProductId || !selectedVariant) {
      setNotification({
        show: true,
        message: 'محصول و وریانت تأمین‌کننده را انتخاب کنید',
        type: 'warning',
      })
      return
    }
    if (!name.trim()) {
      setNotification({ show: true, message: 'نام پلن را وارد کنید', type: 'warning' })
      return
    }
    if (!durationLabel.trim()) {
      setNotification({ show: true, message: 'زمان اشتراک را وارد کنید', type: 'warning' })
      return
    }

    let warrantyDaysValue: number | null = null
    if (warrantyType === 'days') {
      const parsed = Number.parseInt(warrantyDays, 10)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setNotification({
          show: true,
          message: 'تعداد روز گارانتی معتبر نیست',
          type: 'warning',
        })
        return
      }
      warrantyDaysValue = parsed
    } else if (warrantyType === 'none') {
      warrantyDaysValue = 0
    }

    if (pricingMode === 'fixed') {
      const toman = Number.parseInt(fixedToman.replace(/,/g, ''), 10)
      if (!Number.isFinite(toman) || toman <= 0) {
        setNotification({
          show: true,
          message: 'قیمت ثابت تومان را وارد کنید',
          type: 'warning',
        })
        return
      }
    }

    const markup = Number.parseInt(markupPercent, 10)
    if (pricingMode === 'variable' && !Number.isFinite(markup)) {
      setNotification({ show: true, message: 'درصد مارکاپ معتبر نیست', type: 'warning' })
      return
    }

    if (noticeKind !== 'none' && !noticeText.trim()) {
      setNotification({
        show: true,
        message: 'متن پیام محصول را وارد کنید',
        type: 'warning',
      })
      return
    }

    for (const field of customFields) {
      if (!field.label.trim()) {
        setNotification({
          show: true,
          message: 'لیبل همه فیلدهای سفارشی را پر کنید',
          type: 'warning',
        })
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        durationLabel: durationLabel.trim(),
        warrantyType,
        warrantyDays: warrantyDaysValue,
        roboticvnProductId: selectedProductId,
        roboticvnVariantId: selectedVariant.id,
        roboticvnVariantTitle: selectedVariant.title,
        pricingMode,
        fixedToman:
          pricingMode === 'fixed'
            ? Number.parseInt(fixedToman.replace(/,/g, ''), 10)
            : null,
        markupPercent: pricingMode === 'variable' ? markup : 0,
        customFields: customFields.map((field) => ({
          id: field.id,
          label: field.label.trim(),
          placeholder: field.placeholder.trim(),
          required: field.required,
        })),
        noticeKind,
        noticeText: noticeKind === 'none' ? null : noticeText.trim(),
        isActive,
      }

      if (isEdit && editPlanId != null) {
        await updateAdminAccountPlan(editPlanId, payload)
      } else {
        await createAdminAccountPlan({
          categoryId,
          ...payload,
        })
      }
      haptic('medium')
      navigate(`/admin/account-plans/${categoryId}`, { replace: true })
    } catch (error) {
      setNotification({
        show: true,
        message: error instanceof Error ? error.message : 'ذخیره پلن ناموفق بود',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!ready || !allowed || !categoryId || !category) return null

  if (loadingPlan) {
    return (
      <AdminScreen
        sticky
        title="ویرایش پلن"
        eyebrow={category.label}
        onBack={handleBack}
      >
        <p className="admin__muted" style={{ paddingInline: 'var(--page-padding-x)' }}>
          در حال بارگذاری پلن…
        </p>
      </AdminScreen>
    )
  }

  const variantUsd =
    selectedVariant && typeof selectedVariant.prices?.usd === 'number'
      ? selectedVariant.prices.usd
      : null

  return (
    <AdminScreen
      sticky
      title={isEdit ? 'ویرایش پلن' : 'افزودن پلن'}
      eyebrow={category.label}
      onBack={handleBack}
      notification={notification}
      onCloseNotification={() => setNotification((prev) => ({ ...prev, show: false }))}
    >
      <div className="aap-create shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <section
          className={`aap-create__section${isProductOpen ? ' aap-create__section--open' : ''}`}
        >
          <div className="aap-create__section-head">
            <h2 className="aap-create__section-title">محصول تأمین‌کننده</h2>
            <span className="aap-create__section-hint">مرحله ۱</span>
          </div>

          <div className="aap-create__select" ref={productSelectRef}>
            <button
              type="button"
              className={`aap-create__select-trigger${
                selectedProductId
                  ? ' aap-create__select-trigger--selected'
                  : ' aap-create__select-trigger--empty'
              }${isProductOpen ? ' aap-create__select-trigger--open' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={isProductOpen}
              onClick={() => {
                haptic('light')
                setIsVariantOpen(false)
                setIsProductOpen((prev) => !prev)
              }}
            >
              {selectedProductId && selectedProductTitle ? (
                <span className="aap-create__select-top">
                  <span className="aap-create__select-content">
                    <span className="aap-create__select-title">{selectedProductTitle}</span>
                    <span className="aap-create__select-subtitle" dir="ltr">
                      {selectedProductId}
                    </span>
                  </span>
                  <span className="aap-create__select-icon" aria-hidden>
                    <span
                      className={`aap-create__select-icon-layer${
                        !isProductOpen ? ' aap-create__select-icon-layer--active' : ''
                      }`}
                    >
                      <CursorAddSelection01Icon width={20} height={20} />
                    </span>
                    <span
                      className={`aap-create__select-icon-layer${
                        isProductOpen ? ' aap-create__select-icon-layer--active' : ''
                      }`}
                    >
                      <CursorRemoveSelection01Icon width={20} height={20} />
                    </span>
                  </span>
                </span>
              ) : (
                <>
                  <span className="aap-create__select-content">
                    <span className="aap-create__select-placeholder">محصول را انتخاب کنید</span>
                    <span className="aap-create__select-placeholder-hint">
                      جستجو و انتخاب از کاتالوگ Roboticvn
                    </span>
                  </span>
                  <span className="aap-create__select-icon" aria-hidden>
                    <span
                      className={`aap-create__select-icon-layer${
                        !isProductOpen ? ' aap-create__select-icon-layer--active' : ''
                      }`}
                    >
                      <CursorAddSelection01Icon width={20} height={20} />
                    </span>
                    <span
                      className={`aap-create__select-icon-layer${
                        isProductOpen ? ' aap-create__select-icon-layer--active' : ''
                      }`}
                    >
                      <CursorRemoveSelection01Icon width={20} height={20} />
                    </span>
                  </span>
                </>
              )}
            </button>

            {selectedProductId ? (
              <button
                type="button"
                className="aap-create__clear"
                onClick={clearProduct}
              >
                تغییر محصول
              </button>
            ) : null}

            {isProductOpen ? (
              <div className="aap-create__select-menu" role="listbox" aria-label="محصولات">
                <div className="aap-create__search-row">
                  <input
                    className="admin__input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void runSearch(search)
                      }
                    }}
                    placeholder="جستجوی محصول…"
                    dir="auto"
                  />
                  <button
                    type="button"
                    className="admin__btn admin__btn--ghost"
                    disabled={searching}
                    onClick={() => void runSearch(search)}
                  >
                    {searching ? '…' : 'جستجو'}
                  </button>
                </div>
                {products.length === 0 ? (
                  <p className="aap-create__menu-empty">محصولی پیدا نشد</p>
                ) : (
                  products.map((product) => {
                    const isSelected = selectedProductId === product.id
                    return (
                      <button
                        key={product.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`aap-create__select-option${
                          isSelected ? ' aap-create__select-option--selected' : ''
                        }`}
                        onClick={() => void selectProduct(product.id)}
                      >
                        <span className="aap-create__select-option-main">
                          <span className="aap-create__select-option-name">{product.title}</span>
                          <span className="aap-create__select-option-desc" dir="ltr">
                            {product.id}
                          </span>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>
        </section>

        {selectedProductId ? (
          <section
            className={`aap-create__section shop-rise${
              isVariantOpen ? ' aap-create__section--open' : ''
            }`}
            style={{ '--rise-index': 1 } as CSSProperties}
          >
            <div className="aap-create__section-head">
              <h2 className="aap-create__section-title">وریانت</h2>
              <span className="aap-create__section-hint">مرحله ۲</span>
            </div>

            {loadingDetail ? (
              <p className="admin__muted">در حال دریافت وریانت‌ها…</p>
            ) : (
              <div className="aap-create__select" ref={variantSelectRef}>
                <button
                  type="button"
                  className={`aap-create__select-trigger${
                    selectedVariant
                      ? ' aap-create__select-trigger--selected'
                      : ' aap-create__select-trigger--empty'
                  }${isVariantOpen ? ' aap-create__select-trigger--open' : ''}`}
                  aria-haspopup="listbox"
                  aria-expanded={isVariantOpen}
                  onClick={() => {
                    haptic('light')
                    setIsProductOpen(false)
                    setIsVariantOpen((prev) => !prev)
                  }}
                >
                  {selectedVariant ? (
                    <>
                      <span className="aap-create__select-top">
                        <span className="aap-create__select-content">
                          <span className="aap-create__select-title">{selectedVariant.title}</span>
                          <span className="aap-create__select-subtitle">
                            {selectedVariant.in_stock
                              ? `${selectedVariant.available_quantity.toLocaleString('fa-IR')} موجود`
                              : 'ناموجود'}
                            {variantUsd != null ? ` · $${variantUsd}` : ''}
                          </span>
                        </span>
                        <span className="aap-create__select-icon" aria-hidden>
                          <span
                            className={`aap-create__select-icon-layer${
                              !isVariantOpen ? ' aap-create__select-icon-layer--active' : ''
                            }`}
                          >
                            <CursorAddSelection01Icon width={20} height={20} />
                          </span>
                          <span
                            className={`aap-create__select-icon-layer${
                              isVariantOpen ? ' aap-create__select-icon-layer--active' : ''
                            }`}
                          >
                            <CursorRemoveSelection01Icon width={20} height={20} />
                          </span>
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="aap-create__select-content">
                        <span className="aap-create__select-placeholder">وریانت را انتخاب کنید</span>
                        <span className="aap-create__select-placeholder-hint">
                          موجودی و قیمت پایه هر وریانت
                        </span>
                      </span>
                      <span className="aap-create__select-icon" aria-hidden>
                        <span
                          className={`aap-create__select-icon-layer${
                            !isVariantOpen ? ' aap-create__select-icon-layer--active' : ''
                          }`}
                        >
                          <CursorAddSelection01Icon width={20} height={20} />
                        </span>
                        <span
                          className={`aap-create__select-icon-layer${
                            isVariantOpen ? ' aap-create__select-icon-layer--active' : ''
                          }`}
                        >
                          <CursorRemoveSelection01Icon width={20} height={20} />
                        </span>
                      </span>
                    </>
                  )}
                </button>

                {isVariantOpen ? (
                  <div className="aap-create__select-menu" role="listbox" aria-label="وریانت‌ها">
                    {(productDetail?.variants ?? []).length === 0 ? (
                      <p className="aap-create__menu-empty">وریانتی موجود نیست</p>
                    ) : (
                      productDetail?.variants.map((variant) => {
                        const isSelected = selectedVariant?.id === variant.id
                        const usd =
                          typeof variant.prices?.usd === 'number' ? variant.prices.usd : null
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`aap-create__select-option${
                              isSelected ? ' aap-create__select-option--selected' : ''
                            }`}
                            onClick={() => selectVariant(variant)}
                          >
                            <span className="aap-create__select-option-main">
                              <span className="aap-create__select-option-name">{variant.title}</span>
                              <span className="aap-create__select-option-desc">
                                {variant.in_stock
                                  ? `${variant.available_quantity.toLocaleString('fa-IR')} موجود`
                                  : 'ناموجود'}
                                {usd != null ? ` · $${usd}` : ''}
                              </span>
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {selectedVariant ? (
          <>
            <section
              className="aap-create__section shop-rise"
              style={{ '--rise-index': 2 } as CSSProperties}
            >
              <div className="aap-create__section-head">
                <h2 className="aap-create__section-title">جزئیات نمایش</h2>
              </div>
              <label className="aap-create__field">
                <span>نام پلن</span>
                <input
                  className="admin__input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="مثلاً کپ‌کات پرو ۱ ماه"
                />
              </label>
              <label className="aap-create__field">
                <span>زمان اشتراک</span>
                <input
                  className="admin__input"
                  value={durationLabel}
                  onChange={(event) => setDurationLabel(event.target.value)}
                  placeholder="۱ ماه"
                />
              </label>
              <div className="aap-create__field">
                <span>گارانتی</span>
                <div className="aap-create__chips">
                  {(
                    [
                      ['none', 'بدون'],
                      ['days', 'روز'],
                      ['full', 'کامل'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`aap-create__chip${warrantyType === value ? ' is-selected' : ''}`}
                      onClick={() => {
                        haptic('light')
                        setWarrantyType(value)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {warrantyType === 'days' ? (
                  <div className="aap-create__chips aap-create__chips--days">
                    {['7', '30'].map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={`aap-create__chip${warrantyDays === days ? ' is-selected' : ''}`}
                        onClick={() => {
                          haptic('light')
                          setWarrantyDays(days)
                        }}
                      >
                        {days === '7' ? '۷ روز' : '۳۰ روز'}
                      </button>
                    ))}
                    <input
                      className="admin__input aap-create__days-input"
                      inputMode="numeric"
                      value={warrantyDays}
                      onChange={(event) => setWarrantyDays(event.target.value)}
                      placeholder="روز"
                    />
                  </div>
                ) : null}
                <p className="aap-create__hint">پیش‌نمایش: {warrantyPreview}</p>
              </div>
            </section>

            <section
              className="aap-create__section shop-rise"
              style={{ '--rise-index': 3 } as CSSProperties}
            >
              <div className="aap-create__section-head">
                <h2 className="aap-create__section-title">پیام محصول</h2>
                <span className="aap-create__section-hint">اختیاری</span>
              </div>
              <p className="aap-create__hint">
                یک نکته، هشدار یا اطلاعات کوتاه برای نمایش به خریدار.
              </p>
              <div className="aap-create__chips">
                {(
                  [
                    ['none', 'بدون'],
                    ['note', 'نکته'],
                    ['info', 'اطلاعات'],
                    ['warning', 'هشدار'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`aap-create__chip aap-create__chip--notice-${value}${
                      noticeKind === value ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      haptic('light')
                      setNoticeKind(value)
                      if (value === 'none') setNoticeText('')
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {noticeKind !== 'none' ? (
                <label className="aap-create__field">
                  <span>متن {noticeKindLabel(noticeKind)}</span>
                  <textarea
                    className="admin__input aap-create__textarea"
                    value={noticeText}
                    onChange={(event) => setNoticeText(event.target.value)}
                    placeholder={`متن ${noticeKindLabel(noticeKind)} را بنویسید…`}
                    rows={3}
                    maxLength={500}
                  />
                </label>
              ) : null}
              {noticeKind !== 'none' && noticeText.trim() ? (
                <div className={`aap-notice aap-notice--${noticeKind}`} role="note">
                  <strong>{noticeKindLabel(noticeKind)}</strong>
                  <p>{noticeText.trim()}</p>
                </div>
              ) : null}
            </section>

            <section
              className="aap-create__section shop-rise"
              style={{ '--rise-index': 4 } as CSSProperties}
            >
              <div className="aap-create__section-head">
                <h2 className="aap-create__section-title">فیلدهای سفارش</h2>
                <button
                  type="button"
                  className="aap-create__link-btn"
                  onClick={() => {
                    haptic('light')
                    setCustomFields([
                      ...customFields,
                      { id: newFieldId(), label: '', placeholder: '', required: true },
                    ])
                  }}
                >
                  + افزودن
                </button>
              </div>
              {customFields.length === 0 ? (
                <p className="aap-create__hint">مثلاً ایمیل، لینک کانال یا کد دعوت.</p>
              ) : (
                customFields.map((field, index) => (
                  <div key={field.id} className="aap-create__custom-card">
                    <div className="aap-create__custom-grid">
                      <input
                        className="admin__input"
                        value={field.label}
                        onChange={(event) => {
                          const next = [...customFields]
                          next[index] = { ...field, label: event.target.value }
                          setCustomFields(next)
                        }}
                        placeholder="لیبل"
                      />
                      <input
                        className="admin__input"
                        value={field.placeholder}
                        onChange={(event) => {
                          const next = [...customFields]
                          next[index] = { ...field, placeholder: event.target.value }
                          setCustomFields(next)
                        }}
                        placeholder="پلیس‌هولدر"
                      />
                    </div>
                    <div className="aap-create__custom-foot">
                      <label className="aap-create__check">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) => {
                            const next = [...customFields]
                            next[index] = { ...field, required: event.target.checked }
                            setCustomFields(next)
                          }}
                        />
                        الزامی
                      </label>
                      <button
                        type="button"
                        className="aap-create__link-btn is-danger"
                        onClick={() => {
                          setCustomFields(customFields.filter((item) => item.id !== field.id))
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section
              className="aap-create__section shop-rise"
              style={{ '--rise-index': 5 } as CSSProperties}
            >
              <div className="aap-create__section-head">
                <h2 className="aap-create__section-title">قیمت‌گذاری</h2>
              </div>
              <div className="aap-create__chips">
                {(
                  [
                    ['variable', 'متغیر (USD × نرخ)'],
                    ['fixed', 'ثابت تومان'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`aap-create__chip${pricingMode === value ? ' is-selected' : ''}`}
                    onClick={() => {
                      haptic('light')
                      setPricingMode(value)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {pricingMode === 'fixed' ? (
                <label className="aap-create__field">
                  <span>قیمت تومان</span>
                  <input
                    className="admin__input"
                    inputMode="numeric"
                    value={fixedToman}
                    onChange={(event) => setFixedToman(event.target.value)}
                    placeholder="مثلاً ۲۵۰۰۰۰"
                  />
                </label>
              ) : (
                <label className="aap-create__field">
                  <span>درصد مارکاپ روی نرخ</span>
                  <input
                    className="admin__input"
                    inputMode="numeric"
                    value={markupPercent}
                    onChange={(event) => setMarkupPercent(event.target.value)}
                    placeholder="۰"
                  />
                  {variantUsd != null ? (
                    <p className="aap-create__hint">قیمت پایه وریانت: ${variantUsd}</p>
                  ) : null}
                </label>
              )}
            </section>

            <button
              type="button"
              className="admin__btn aap-create__submit shop-rise"
              style={{ '--rise-index': 6 } as CSSProperties}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'در حال ذخیره…' : isEdit ? 'ذخیره تغییرات' : 'ذخیره پلن'}
            </button>
          </>
        ) : null}
      </div>
    </AdminScreen>
  )
}
