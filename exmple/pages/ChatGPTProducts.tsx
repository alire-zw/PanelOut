import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { AccountShopPlanStats } from '../components/AccountShopPlanStats'
import CursorAddSelection01Icon from '../components/icons/cursor-add-selection-01-stroke-rounded'
import CursorRemoveSelection01Icon from '../components/icons/cursor-remove-selection-01-stroke-rounded'
import { PageHeader } from '../components/PageHeader'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import {
  accountShopConfirmRoute,
  accountShopProductKey,
  isAccountShopCategoryId,
} from '../data/accountShopProducts'
import { useProductPageView } from '../hooks/useProductPageView'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/api'
import {
  fetchAccountShopProducts,
  type AccountShopProduct,
} from '../lib/chatgpt'
import type {
  AccountShopConfirmState,
  AccountShopProductsRestoreState,
} from '../types/accountShop'
import '../styles/shop-rise.css'
import './ChatGPT.css'

function noticeTitle(kind: NonNullable<AccountShopProduct['noticeKind']>) {
  if (kind === 'warning') return 'هشدار'
  if (kind === 'info') return 'اطلاعات'
  return 'نکته'
}

export function ChatGPTProductsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { categoryId: categoryIdParam } = useParams<{ categoryId: string }>()
  const { haptic } = useTelegram()
  const planSelectRef = useRef<HTMLDivElement>(null)

  const categoryId =
    categoryIdParam && isAccountShopCategoryId(categoryIdParam) ? categoryIdParam : null
  const category =
    ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === categoryId) ?? null

  useProductPageView(categoryId ? accountShopProductKey(categoryId) : '')

  const [products, setProducts] = useState<AccountShopProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [isPlanOpen, setIsPlanOpen] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  const handleBack = useCallback(() => {
    navigate('/chatgpt', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (categoryId) return
    navigate('/chatgpt', { replace: true })
  }, [categoryId, navigate])

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
    const restored = location.state as AccountShopProductsRestoreState | null
    if (!restored?.categoryId || restored.categoryId !== categoryId) return
    if (restored.productId) setSelectedProductId(restored.productId)
    if (restored.fieldValues) setFieldValues(restored.fieldValues)
  }, [categoryId, location.key, location.state])

  const loadProducts = useCallback(async () => {
    if (!categoryId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const catalog = await fetchAccountShopProducts(categoryId)
      setProducts(
        catalog.products
          .filter((item) => item.categoryId === categoryId)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      )
    } catch (error: unknown) {
      setProducts([])
      setLoadError(
        error instanceof Error ? error.message : 'دریافت محصولات با خطا مواجه شد',
      )
    } finally {
      setIsLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (!isPlanOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (planSelectRef.current && !planSelectRef.current.contains(target)) {
        setIsPlanOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isPlanOpen])

  const selectedProduct =
    products.find((item) => item.productId === selectedProductId) ?? null

  useEffect(() => {
    if (!selectedProduct) {
      setFieldValues({})
      return
    }
    const fields = selectedProduct.customFields ?? []
    setFieldValues((prev) => {
      const next: Record<string, string> = {}
      for (const field of fields) {
        next[field.id] = prev[field.id] ?? ''
      }
      return next
    })
  }, [selectedProduct?.productId])

  const customFields = selectedProduct?.customFields ?? []
  const hasNotice = Boolean(
    selectedProduct?.noticeKind &&
      selectedProduct.noticeKind !== 'none' &&
      selectedProduct.noticeText,
  )

  const fieldsValid = useMemo(() => {
    if (!selectedProduct) return false
    for (const field of customFields) {
      if (!field.required) continue
      if (!(fieldValues[field.id] ?? '').trim()) return false
    }
    return true
  }, [customFields, fieldValues, selectedProduct])

  const canContinue = Boolean(
    selectedProduct &&
      selectedProduct.inStock &&
      fieldsValid &&
      selectedProduct.toman > 0,
  )

  const handleSelectProduct = (product: AccountShopProduct) => {
    if (!product.inStock) return
    haptic('light')
    setSelectedProductId(product.productId)
    setIsPlanOpen(false)
  }

  const handleContinue = () => {
    if (!canContinue || !selectedProduct || !category || !categoryId) return
    haptic('light')

    const trimmedValues: Record<string, string> = {}
    for (const field of customFields) {
      trimmedValues[field.id] = (fieldValues[field.id] ?? '').trim()
    }

    const state: AccountShopConfirmState = {
      categoryId,
      categoryLabel: category.label,
      categoryImageSrc: category.imageSrc,
      product: selectedProduct,
      fieldValues: trimmedValues,
      toman: selectedProduct.toman,
    }

    navigate(accountShopConfirmRoute(categoryId), { state })
  }

  if (!categoryId || !category) {
    return null
  }

  return (
    <div className="account-shop">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title={category.label} onBack={handleBack} />
      </div>

      <div
        className={`account-shop__body${
          isPlanOpen ? ' account-shop__body--select-open' : ''
        }`}
      >
        <section
          className="account-shop__hero account-shop__hero--compact shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label={category.label}
        >
          <div className="account-shop__category-badge" aria-hidden>
            {category.imageSrc ? (
              <img src={category.imageSrc} alt="" width={56} height={56} decoding="async" />
            ) : (
              <span>{category.label.charAt(0)}</span>
            )}
          </div>
          <p className="account-shop__desc">
            {category.shortDesc}. ابتدا پلن را انتخاب کنید، سپس اطلاعات سفارش را وارد کنید.
            <span className="account-shop__desc-accent"> تحویل آنی پس از پرداخت.</span>
          </p>
        </section>

        <section
          className={`account-shop__plans shop-rise${
            isPlanOpen ? ' account-shop__plans--open' : ''
          }`}
          style={{ '--rise-index': 2 } as CSSProperties}
          aria-label="انتخاب پلن"
        >
          <div className="account-shop__section-head">
            <h2 className="account-shop__section-title">انتخاب پلن</h2>
          </div>

          {isLoading ? (
            <div className="account-shop__products-list" aria-hidden>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="account-shop__skeleton account-shop__skeleton--product"
                />
              ))}
            </div>
          ) : loadError ? (
            <EmptyState
              compact
              title={loadError}
              action={
                <button
                  type="button"
                  className="account-shop__retry"
                  onClick={() => void loadProducts()}
                >
                  تلاش مجدد
                </button>
              }
            />
          ) : products.length === 0 ? (
            <EmptyState compact title="پلنی برای این دسته موجود نیست" />
          ) : (
            <div className="account-shop__select" ref={planSelectRef}>
              <button
                type="button"
                className={`account-shop__select-trigger${
                  selectedProduct
                    ? ' account-shop__select-trigger--selected'
                    : ' account-shop__select-trigger--empty'
                }${isPlanOpen ? ' account-shop__select-trigger--open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={isPlanOpen}
                onClick={() => {
                  haptic('light')
                  setIsPlanOpen((prev) => !prev)
                }}
              >
                {selectedProduct ? (
                  <>
                    <span className="account-shop__select-top">
                      <span className="account-shop__select-content">
                        <span className="account-shop__select-title-row">
                          <span className="account-shop__select-title">{selectedProduct.name}</span>
                          <span className="account-shop__select-stock">
                            {selectedProduct.available != null
                              ? `${selectedProduct.available.toLocaleString('fa-IR')} موجود`
                              : 'آماده تحویل'}
                          </span>
                        </span>
                      </span>
                      <span className="account-shop__select-icon" aria-hidden>
                        <span
                          className={`account-shop__select-icon-layer${
                            !isPlanOpen ? ' account-shop__select-icon-layer--active' : ''
                          }`}
                        >
                          <CursorAddSelection01Icon width={20} height={20} />
                        </span>
                        <span
                          className={`account-shop__select-icon-layer${
                            isPlanOpen ? ' account-shop__select-icon-layer--active' : ''
                          }`}
                        >
                          <CursorRemoveSelection01Icon width={20} height={20} />
                        </span>
                      </span>
                    </span>
                    <AccountShopPlanStats
                      toman={selectedProduct.toman}
                      durationLabel={selectedProduct.durationLabel}
                      warrantyLabel={selectedProduct.warrantyLabel}
                      compact
                    />
                  </>
                ) : (
                  <>
                    <span className="account-shop__select-content">
                      <span className="account-shop__select-placeholder">پلن را انتخاب کنید</span>
                      <span className="account-shop__select-placeholder-hint">
                        مدت، گارانتی و قیمت هر پلن
                      </span>
                    </span>
                    <span className="account-shop__select-icon" aria-hidden>
                      <span
                        className={`account-shop__select-icon-layer${
                          !isPlanOpen ? ' account-shop__select-icon-layer--active' : ''
                        }`}
                      >
                        <CursorAddSelection01Icon width={20} height={20} />
                      </span>
                      <span
                        className={`account-shop__select-icon-layer${
                          isPlanOpen ? ' account-shop__select-icon-layer--active' : ''
                        }`}
                      >
                        <CursorRemoveSelection01Icon width={20} height={20} />
                      </span>
                    </span>
                  </>
                )}
              </button>

              {isPlanOpen ? (
                <div
                  className="account-shop__select-menu"
                  role="listbox"
                  aria-label="لیست پلن‌ها"
                >
                  {products.map((product) => {
                    const isSelected = selectedProductId === product.productId
                    const unavailable = !product.inStock
                    return (
                      <button
                        key={product.productId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={unavailable}
                        className={`account-shop__select-option${
                          isSelected ? ' account-shop__select-option--selected' : ''
                        }${unavailable ? ' account-shop__select-option--disabled' : ''}`}
                        onClick={() => handleSelectProduct(product)}
                      >
                        <span className="account-shop__select-option-main">
                          <span className="account-shop__select-option-head">
                            <span className="account-shop__select-option-name">{product.name}</span>
                            <span
                              className={`account-shop__select-stock${
                                unavailable ? ' is-out' : ''
                              }`}
                            >
                              {unavailable
                                ? 'ناموجود'
                                : product.available != null
                                  ? `${product.available.toLocaleString('fa-IR')} موجود`
                                  : 'آماده تحویل'}
                            </span>
                          </span>
                          <AccountShopPlanStats
                            toman={product.toman}
                            durationLabel={product.durationLabel}
                            warrantyLabel={product.warrantyLabel}
                            unavailable={unavailable}
                          />
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )}
        </section>

        {selectedProduct && !isPlanOpen ? (
          <>
            {hasNotice ? (
              <div
                className={`account-shop__notice account-shop__notice--${selectedProduct.noticeKind} shop-rise`}
                style={{ '--rise-index': 3 } as CSSProperties}
                role="note"
              >
                <strong>{noticeTitle(selectedProduct.noticeKind!)}</strong>
                <p>{selectedProduct.noticeText}</p>
              </div>
            ) : null}

            {customFields.length > 0 ? (
              <section
                className="account-shop__extra shop-rise"
                style={{ '--rise-index': 4 } as CSSProperties}
                aria-label="اطلاعات سفارش"
              >
                <div className="account-shop__section-head">
                  <h2 className="account-shop__section-title">اطلاعات سفارش</h2>
                </div>
                {customFields.map((field) => {
                  const value = fieldValues[field.id] ?? ''
                  const showError = field.required && value.length > 0 && !value.trim()
                  return (
                    <div key={field.id} className="account-shop__extra-block">
                      <label className="account-shop__field-label" htmlFor={`af-${field.id}`}>
                        {field.label}
                        {field.required ? '' : ' (اختیاری)'}
                      </label>
                      <div
                        className={`account-shop__field${
                          showError ? ' account-shop__field--error' : ''
                        }`}
                      >
                        <input
                          id={`af-${field.id}`}
                          type="text"
                          className="account-shop__field-input"
                          value={value}
                          onChange={(event) =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [field.id]: event.target.value,
                            }))
                          }
                          placeholder={field.placeholder || field.label}
                          dir="auto"
                          aria-label={field.label}
                        />
                      </div>
                    </div>
                  )
                })}
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <footer
        className="account-shop__footer shop-rise"
        style={{ '--rise-index': 5 } as CSSProperties}
      >
        <button
          type="button"
          className="account-shop__continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
