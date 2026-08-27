import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useTelegram } from '../hooks/useTelegram'
import { useProductPageView } from '../hooks/useProductPageView'
import { isTelegramWebApp } from '../lib/api'
import { formatTomanPrice } from '../lib/formatStars'
import { CountryFlagImg } from '../components/CountryFlagImg'
import { warmCountryFlagCache } from '../lib/countryFlagCache'
import { getVirtualNumberCountries } from '../lib/virtualNumber'
import { shopHeroPages } from '../data/shopHeroPages'
import type {
  VirtualNumberCountry,
  VirtualNumberCountryGroup,
  VirtualNumberPageRestoreState,
  VirtualNumberQuality,
} from '../types/virtualNumber'
import InformationDiamondIcon from '../components/icons/information-diamond-stroke-rounded'
import {
  VIRTUAL_NUMBER_QUALITY_LABELS,
  VIRTUAL_NUMBER_QUALITY_NOTES,
} from '../types/virtualNumber'
import './VirtualNumber.css'
import '../styles/shop-rise.css'

const heroConfig = shopHeroPages['virtual-number']

const QUALITY_ORDER: VirtualNumberQuality[] = ['economy', 'standard', 'premium']

const SKELETON_COUNTRY_COUNT = 7
const SKELETON_DELAY_MS = 120

function VirtualNumberListSkeleton({ startIndex }: { startIndex: number }) {
  let riseIndex = startIndex

  return (
    <>
      <section
        className="virtual-number__group shop-rise"
        style={{ '--rise-index': riseIndex++ } as CSSProperties}
        aria-hidden
      >
        <div className="virtual-number__skeleton virtual-number__skeleton--title" />
        <div className="virtual-number__qualities-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="virtual-number__skeleton virtual-number__skeleton--quality"
            />
          ))}
        </div>
      </section>

      <div
        className="virtual-number__skeleton virtual-number__skeleton--note shop-rise"
        style={{ '--rise-index': riseIndex++ } as CSSProperties}
        aria-hidden
      />

      <section
        className="virtual-number__group shop-rise"
        style={{ '--rise-index': riseIndex++ } as CSSProperties}
        aria-hidden
      >
        <div className="virtual-number__skeleton virtual-number__skeleton--title" />
        <div className="virtual-number__countries-list">
          {Array.from({ length: SKELETON_COUNTRY_COUNT }).map((_, index) => (
            <div
              key={index}
              className="virtual-number__skeleton virtual-number__skeleton--country"
            />
          ))}
        </div>
      </section>
    </>
  )
}

export function VirtualNumberPage() {
  useProductPageView('virtual-number')
  const navigate = useNavigate()
  const location = useLocation()
  const { haptic } = useTelegram()
  const [groupedCountries, setGroupedCountries] = useState<VirtualNumberCountryGroup[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [servedFromCache, setServedFromCache] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedQuality, setSelectedQuality] = useState<VirtualNumberQuality>('standard')
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null)
  const [animatedReady, setAnimatedReady] = useState(false)
  const animatedRef = useRef<HTMLImageElement>(null)

  const handleBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    const restored = location.state as VirtualNumberPageRestoreState | null
    if (restored?.quality) {
      setSelectedQuality(restored.quality)
    }
    if (restored?.countryId) {
      setSelectedCountryId(restored.countryId)
    }
  }, [location.key, location.state])

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
    const img = animatedRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setAnimatedReady(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const skeletonTimer = window.setTimeout(() => {
      if (!cancelled) {
        setShowSkeleton(true)
      }
    }, SKELETON_DELAY_MS)

    void getVirtualNumberCountries()
      .then((response) => {
        if (cancelled) return

        const orderedGroups = QUALITY_ORDER.flatMap((quality) => {
          const group = response.groups.find((item) => item.quality === quality)
          if (!group || group.items.length === 0) {
            return []
          }

          return [
            {
              quality: group.quality,
              label: group.label || VIRTUAL_NUMBER_QUALITY_LABELS[group.quality],
              items: group.items,
            },
          ]
        })

        if (response.cached) {
          setServedFromCache(true)
          setShowSkeleton(false)
        }

        if (orderedGroups.length === 0) {
          setLoadError('لیست کشورها در حال آماده‌سازی است. لطفاً چند لحظه دیگر دوباره تلاش کنید.')
        } else {
          setGroupedCountries(orderedGroups)
          setLoadError(null)

          void warmCountryFlagCache(
            orderedGroups.flatMap((group) => group.items.map((item) => item.flagCode)),
          )
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'خطا در دریافت لیست کشورها')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsFetching(false)
          setShowSkeleton(false)
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(skeletonTimer)
    }
  }, [])

  useEffect(() => {
    if (groupedCountries.length === 0) {
      return
    }

    const hasSelectedGroup = groupedCountries.some((group) => group.quality === selectedQuality)
    if (!hasSelectedGroup) {
      const fallback =
        groupedCountries.find((group) => group.quality === 'standard') ?? groupedCountries[0]
      setSelectedQuality(fallback.quality)
    }
  }, [groupedCountries, selectedQuality])

  useEffect(() => {
    if (groupedCountries.length === 0 || !selectedCountryId) {
      return
    }

    const matchedGroup = groupedCountries.find((group) =>
      group.items.some((item) => item.countryId === selectedCountryId),
    )

    if (matchedGroup && matchedGroup.quality !== selectedQuality) {
      setSelectedQuality(matchedGroup.quality)
    }
  }, [groupedCountries, selectedCountryId, selectedQuality])

  const activeGroup = useMemo(
    () => groupedCountries.find((group) => group.quality === selectedQuality) ?? null,
    [groupedCountries, selectedQuality],
  )

  const selectedCountry = useMemo(
    () => activeGroup?.items.find((item) => item.countryId === selectedCountryId) ?? null,
    [activeGroup, selectedCountryId],
  )

  useEffect(() => {
    if (!selectedCountryId || groupedCountries.length === 0) return
    const matched = groupedCountries
      .flatMap((group) => group.items)
      .find((item) => item.countryId === selectedCountryId)
    if (matched && matched.available === false) {
      setSelectedCountryId(null)
    }
  }, [groupedCountries, selectedCountryId])

  const handleSelectQuality = (quality: VirtualNumberQuality) => {
    haptic('light')
    setSelectedQuality(quality)
    setSelectedCountryId(null)
  }

  const handleSelectCountry = (country: VirtualNumberCountry) => {
    if (!country.available) return
    haptic('light')
    setSelectedCountryId(country.countryId)
  }

  const handleContinue = () => {
    if (!selectedCountry || !selectedCountry.available) return

    haptic('light')
    navigate('/virtual-number/confirm', {
      state: {
        countryId: selectedCountry.countryId,
        country: selectedCountry.country,
        flagCode: selectedCountry.flagCode,
        quality: selectedCountry.quality,
        toman: selectedCountry.toman,
      },
    })
  }

  let riseIndex = 2

  return (
    <div className="virtual-number">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="شماره مجازی" onBack={handleBack} />
      </div>

      <div className="virtual-number__body">
        <section
          className="virtual-number__hero shop-rise"
          style={{ '--rise-index': 1 } as CSSProperties}
          aria-label="شماره مجازی"
        >
          <div className="virtual-number__image-wrap" aria-hidden>
            <div className="virtual-number__image-glow" />
            <img
              src={heroConfig.stillSrc}
              alt=""
              className={`virtual-number__image virtual-number__image--still${
                animatedReady ? ' virtual-number__image--hidden' : ''
              }`}
              width={90}
              height={90}
              fetchPriority="high"
              decoding="async"
            />
            <img
              ref={animatedRef}
              src={heroConfig.animatedSrc}
              alt=""
              className={`virtual-number__image virtual-number__image--animated${
                animatedReady ? ' virtual-number__image--visible' : ''
              }`}
              width={90}
              height={90}
              decoding="async"
              onLoad={() => setAnimatedReady(true)}
            />
          </div>

          <p className="virtual-number__desc">
            ابتدا کیفیت شماره را انتخاب کنید، سپس کشور مورد نظر را مشخص کنید.
          </p>
        </section>

        {showSkeleton && isFetching && !servedFromCache ? (
          <VirtualNumberListSkeleton startIndex={riseIndex} />
        ) : loadError ? (
          <p
            className="virtual-number__error shop-rise"
            style={{ '--rise-index': riseIndex++ } as CSSProperties}
            role="alert"
          >
            {loadError}
          </p>
        ) : groupedCountries.length > 0 ? (
          <>
            <section
              className="virtual-number__group shop-rise"
              style={{ '--rise-index': riseIndex++ } as CSSProperties}
              aria-label="انتخاب کیفیت"
            >
              <h2 className="virtual-number__section-title">انتخاب کیفیت</h2>

              <div
                className="virtual-number__qualities-list"
                role="radiogroup"
                aria-label="کیفیت شماره"
              >
                {groupedCountries.map((group) => {
                  const isSelected = selectedQuality === group.quality

                  return (
                    <button
                      key={group.quality}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`virtual-number__quality${
                        isSelected ? ' virtual-number__quality--selected' : ''
                      }`}
                      onClick={() => handleSelectQuality(group.quality)}
                    >
                      <span className="virtual-number__quality-label">{group.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {activeGroup ? (
              <>
                <div
                  className="virtual-number__quality-note shop-rise"
                  style={{ '--rise-index': riseIndex++ } as CSSProperties}
                >
                  <InformationDiamondIcon
                    width={16}
                    height={16}
                    className="virtual-number__quality-note-icon"
                  />
                  <p className="virtual-number__quality-note-text">
                    {VIRTUAL_NUMBER_QUALITY_NOTES[selectedQuality]}
                  </p>
                </div>

                <section
                  className="virtual-number__group shop-rise"
                  style={{ '--rise-index': riseIndex++ } as CSSProperties}
                  aria-label="انتخاب کشور"
                >
                  <h2 className="virtual-number__section-title">انتخاب کشور</h2>

                <div
                  className="virtual-number__countries-list"
                  role="radiogroup"
                  aria-label="کشور"
                >
                  {activeGroup.items.map((country) => {
                    const isSelected = selectedCountryId === country.countryId
                    const unavailable = country.available === false

                    return (
                      <button
                        key={country.countryId}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-disabled={unavailable}
                        disabled={unavailable}
                        className={`virtual-number__country${
                          isSelected ? ' virtual-number__country--selected' : ''
                        }${unavailable ? ' virtual-number__country--unavailable' : ''}`}
                        onClick={() => handleSelectCountry(country)}
                      >
                        <span className="virtual-number__country-start">
                          <CountryFlagImg
                            flagCode={country.flagCode}
                            className="virtual-number__country-flag"
                            width={24}
                            height={18}
                          />
                          <span className="virtual-number__country-label">
                            {country.country}
                            {unavailable ? (
                              <span className="virtual-number__country-unavailable-tag">
                                در حال حاضر ناموجود
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="virtual-number__country-price">
                          <span className="virtual-number__country-price-value">
                            {formatTomanPrice(country.toman)}
                          </span>
                          <span className="virtual-number__country-price-unit">تومان</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <footer
        className="virtual-number__footer shop-rise"
        style={{ '--rise-index': riseIndex } as CSSProperties}
      >
        <button
          type="button"
          className="virtual-number__continue"
          disabled={!selectedCountry || selectedCountry.available === false}
          onClick={handleContinue}
        >
          ادامه
        </button>
      </footer>
    </div>
  )
}
