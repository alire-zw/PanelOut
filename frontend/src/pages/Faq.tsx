import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { SolarIcon } from '../components/SolarIcon'
import SearchIcon from '../components/icons/SearchIcon'
import { FAQ_CATEGORIES } from '../data/faqContent'
import { useTelegram } from '../hooks/useTelegram'
import { isTelegramWebApp } from '../lib/telegram'
import '../styles/shop-rise.css'
import './Faq.css'

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m6 9 6 6 6-6"
      />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m18 6-12 12M6 6l12 12"
      />
    </svg>
  )
}

export function FaqPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const handleBack = useCallback(() => {
    haptic('light')
    navigate('/')
  }, [haptic, navigate])

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

  const toggleItem = (id: string) => {
    haptic('light')
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleCategorySelect = (catId: string) => {
    haptic('light')
    setSelectedCategory(catId)
  }

  const handleClearSearch = () => {
    haptic('light')
    setSearchQuery('')
  }

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return FAQ_CATEGORIES.map((cat) => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
        return null
      }

      if (!query) {
        return cat
      }

      const matchingQuestions = cat.questions.filter(
        (q) =>
          q.question.toLowerCase().includes(query) ||
          q.answer.toLowerCase().includes(query),
      )

      if (matchingQuestions.length === 0) {
        return null
      }

      return {
        ...cat,
        questions: matchingQuestions,
      }
    }).filter((cat): cat is typeof FAQ_CATEGORIES[number] => cat !== null)
  }, [searchQuery, selectedCategory])

  const totalFilteredQuestions = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.questions.length, 0)
  }, [filteredCategories])

  return (
    <div className="faq-page">
      <div className="shop-rise" style={{ '--rise-index': 0 } as CSSProperties}>
        <PageHeader title="سوالات متداول" onBack={handleBack} />
      </div>

      <div className="faq-page__content">
        <section className="faq-hero shop-rise" style={{ '--rise-index': 1 } as CSSProperties}>
          <div className="faq-hero__copy">
            <span className="faq-hero__eyebrow">راهنمای جامع</span>
            <h1 className="faq-hero__title">
              سوالات متداول <span className="faq-hero__accent">پنلوت</span>
            </h1>
            <p className="faq-hero__sub">
              پاسخ به سوالات پرتکرار درباره سرویس‌های پنل، اوتباند و کیف پول
            </p>
          </div>
        </section>

        <div className="faq-search shop-rise" style={{ '--rise-index': 2 } as CSSProperties}>
          <span className="faq-search__icon" aria-hidden="true">
            <SearchIcon width={18} height={18} color="currentColor" />
          </span>
          <input
            type="search"
            className="faq-search__input"
            placeholder="جستجو در سوالات و پاسخ‌ها..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="جستجو در سوالات متداول"
            autoComplete="off"
          />
          {searchQuery.trim() ? (
            <button
              type="button"
              className="faq-search__clear"
              onClick={handleClearSearch}
              aria-label="پاک کردن جستجو"
            >
              <ClearIcon />
            </button>
          ) : null}
        </div>

        <div
          className="faq-tabs shop-rise"
          style={{ '--rise-index': 3 } as CSSProperties}
          role="tablist"
          aria-label="دسته‌بندی سوالات"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            className={`faq-tab${selectedCategory === 'all' ? ' faq-tab--active' : ''}`}
            onClick={() => handleCategorySelect('all')}
          >
            همه سوالات
          </button>
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
              className={`faq-tab${selectedCategory === cat.id ? ' faq-tab--active' : ''}`}
              onClick={() => handleCategorySelect(cat.id)}
            >
              <SolarIcon icon={cat.icon as `solar:${string}`} width={16} height={16} />
              <span>{cat.title}</span>
            </button>
          ))}
        </div>

        {totalFilteredQuestions === 0 ? (
          <div className="faq-empty shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
            <EmptyState
              title="موردی با این عبارت پیدا نشد"
              action={
                searchQuery.trim() ? (
                  <button type="button" className="faq-empty__reset" onClick={handleClearSearch}>
                    پاک کردن فیلتر جستجو
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="faq-groups shop-rise" style={{ '--rise-index': 4 } as CSSProperties}>
            {filteredCategories.map((category) => (
              <div key={category.id} className="faq-group">
                <div className="faq-group__header">
                  <span className="faq-group__icon">
                    <SolarIcon icon={category.icon as `solar:${string}`} width={18} height={18} />
                  </span>
                  <h2 className="faq-group__title">{category.title}</h2>
                  <span className="faq-group__count">{category.questions.length.toLocaleString('fa-IR')}</span>
                </div>

                <div className="faq-group__items">
                  {category.questions.map((item) => {
                    const isOpen = Boolean(openItems[item.id])
                    return (
                      <div
                        key={item.id}
                        className={`faq-item${isOpen ? ' faq-item--open' : ''}`}
                      >
                        <button
                          type="button"
                          className="faq-item__trigger"
                          onClick={() => toggleItem(item.id)}
                          aria-expanded={isOpen}
                          aria-controls={`faq-answer-${item.id}`}
                        >
                          <span className="faq-item__question">{item.question}</span>
                          <span className="faq-item__chevron" aria-hidden="true">
                            <ChevronDownIcon />
                          </span>
                        </button>
                        <div
                          id={`faq-answer-${item.id}`}
                          className="faq-item__content"
                          role="region"
                          aria-hidden={!isOpen}
                        >
                          <div className="faq-item__body">
                            {item.answer.split('\n').map((line, idx) => (
                              <p key={idx}>{line}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="faq-support shop-rise" style={{ '--rise-index': 5 } as CSSProperties}>
          <div className="faq-support__card">
            <div className="faq-support__icon">
              <SolarIcon icon="solar:chat-round-dots-bold" width={22} height={22} />
            </div>
            <div className="faq-support__text">
              <h3 className="faq-support__title">پاسخ سوالت رو پیدا نکردی؟</h3>
              <p className="faq-support__desc">
                تیم پشتیبانی پنلوت آماده پاسخگویی و راهنمایی شماست.
              </p>
            </div>
            <button
              type="button"
              className="faq-support__btn"
              onClick={() => {
                haptic('light')
                navigate('/support')
              }}
            >
              گفتگو با پشتیبانی
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
