import { useMemo, type CSSProperties } from 'react'
import ArrowLeftIcon from './icons/ArrowLeftIcon'
import ChatGPTIcon from './icons/ChatGPTIcon'
import { ACCOUNT_SHOP_CATEGORY_OPTIONS } from '../data/accountShopCategories'
import { parseAccountShopProductKey } from '../data/accountShopProducts'
import { shopCategories, type ShopCategory } from '../data/shopCategories'
import { shopSpotlight, type ShopSpotlightEntry } from '../data/shopSpotlight'
import { useTelegram } from '../hooks/useTelegram'
import '../styles/shop-rise.css'
import './ShopSpotlight.css'

type ShopSpotlightProps = {
  riseIndex: number
  onSelect: (categoryId: string, isActive: boolean) => void
}

type ResolvedSpotlight = {
  entry: ShopSpotlightEntry
  label: string
  gradient: string
  iconColor?: string
  imageSrc: string | null
  isAccount: boolean
  Icon: ShopCategory['icon'] | null
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/** Interleave shuffled lists so accounts appear more often than other products. */
function weaveAccountHeavy(entries: ResolvedSpotlight[]): ResolvedSpotlight[] {
  const accounts = shuffle(entries.filter((item) => item.isAccount))
  const others = shuffle(entries.filter((item) => !item.isAccount))

  if (accounts.length === 0) return others
  if (others.length === 0) return accounts

  const result: ResolvedSpotlight[] = []
  let accountIndex = 0
  let otherIndex = 0

  while (accountIndex < accounts.length || otherIndex < others.length) {
    for (let i = 0; i < 2 && accountIndex < accounts.length; i += 1) {
      result.push(accounts[accountIndex])
      accountIndex += 1
    }
    if (otherIndex < others.length) {
      result.push(others[otherIndex])
      otherIndex += 1
    }
  }

  return result
}

function resolveSpotlightEntry(entry: ShopSpotlightEntry): ResolvedSpotlight | null {
  const accountId = parseAccountShopProductKey(entry.productKey)
  if (accountId) {
    const account = ACCOUNT_SHOP_CATEGORY_OPTIONS.find((item) => item.id === accountId)
    if (!account) return null
    return {
      entry,
      label: account.label,
      gradient: account.gradient,
      imageSrc: account.stillImageSrc ?? account.imageSrc,
      isAccount: true,
      Icon: ChatGPTIcon,
    }
  }

  const category = shopCategories.find((item) => item.id === entry.productKey)
  if (!category?.isActive) return null
  return {
    entry,
    label: category.label,
    gradient: category.gradient,
    iconColor: category.iconColor,
    imageSrc: null,
    isAccount: false,
    Icon: category.icon,
  }
}

export function ShopSpotlight({ riseIndex, onSelect }: ShopSpotlightProps) {
  const { haptic } = useTelegram()

  const entries = useMemo(
    () =>
      weaveAccountHeavy(
        shopSpotlight
          .map(resolveSpotlightEntry)
          .filter((item): item is ResolvedSpotlight => item != null),
      ),
    [],
  )

  if (entries.length === 0) {
    return null
  }

  return (
    <section
      className="shop-spotlight shop-rise"
      style={{ '--rise-index': riseIndex } as CSSProperties}
      aria-label="پیشنهاد ویژه"
    >
      <div className="shop-spotlight__head">
        <h2 className="shop-spotlight__title">
          پیشنهاد <span className="shop-spotlight__title-accent">ویژه</span>
        </h2>
        <span className="shop-spotlight__count">{entries.length} محصول</span>
      </div>

      <div className="shop-spotlight__scroller" dir="rtl">
        {entries.map(({ entry, label, gradient, iconColor, imageSrc, isAccount, Icon }) => (
          <button
            key={entry.productKey}
            type="button"
            className="shop-spotlight__card"
            style={{ '--card-gradient': gradient } as CSSProperties}
            onClick={() => {
              haptic('light')
              onSelect(entry.productKey, true)
            }}
          >
            <span className="shop-spotlight__glow" aria-hidden="true">
              <span className="shop-spotlight__orb" />
            </span>

            <span className="shop-spotlight__top">
              <span
                className={`shop-spotlight__icon${isAccount ? ' shop-spotlight__icon--account' : ''}`}
              >
                {imageSrc ? (
                  <img src={imageSrc} alt="" width={36} height={36} draggable={false} />
                ) : Icon ? (
                  <Icon width={20} height={20} color={iconColor ?? '#ffffff'} />
                ) : null}
              </span>
              <span className="shop-spotlight__badge">{entry.badge}</span>
            </span>

            <span className="shop-spotlight__copy">
              <span className="shop-spotlight__name">{label}</span>
              <span className="shop-spotlight__desc">{entry.description}</span>
            </span>

            <span className="shop-spotlight__cta">
              مشاهده
              <ArrowLeftIcon width={14} height={14} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
