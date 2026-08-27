import { useEffect, useRef, useState } from 'react'
import {
  ensureShopBannerSrc,
  getCachedShopBannerSrcSync,
  isShopBannerVisuallyReady,
  markShopBannerVisuallyReady,
  resolveShopBannerSrc,
} from '../lib/shopBannerImageCache'
import { resolveShopBannerImageUrl } from '../lib/shopBanners'

interface ShopBannerImgProps {
  url: string
  alt?: string
  className?: string
  priority?: boolean
}

function markComplete(img: HTMLImageElement | null, remoteUrl: string, onReady: () => void) {
  if (!img || !remoteUrl) return
  if (img.complete && img.naturalWidth > 0) {
    markShopBannerVisuallyReady(remoteUrl)
    onReady()
  }
}

export function ShopBannerImg({
  url,
  alt = '',
  className,
  priority = false,
}: ShopBannerImgProps) {
  const remoteUrl = resolveShopBannerImageUrl(url)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [src, setSrc] = useState(() => getCachedShopBannerSrcSync(url) ?? remoteUrl)
  const [loaded, setLoaded] = useState(() =>
    Boolean(remoteUrl && isShopBannerVisuallyReady(remoteUrl)),
  )
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!remoteUrl) {
      setSrc('')
      setLoaded(false)
      return
    }

    let cancelled = false
    const syncCached = getCachedShopBannerSrcSync(url)
    setSrc(syncCached ?? remoteUrl)
    setAttempt(0)

    if (isShopBannerVisuallyReady(remoteUrl) || syncCached?.startsWith('blob:')) {
      setLoaded(true)
    }

    void resolveShopBannerSrc(url)
      .then((resolved) => {
        if (cancelled || !resolved) return
        setSrc((prev) => (prev === resolved ? prev : resolved))
      })
      .catch(() => {
        if (!cancelled) setSrc(remoteUrl)
      })

    return () => {
      cancelled = true
    }
  }, [url, remoteUrl])

  useEffect(() => {
    markComplete(imgRef.current, remoteUrl, () => setLoaded(true))
  }, [src, remoteUrl])

  if (!remoteUrl || !src) {
    return <span className={className} aria-hidden="true" />
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={`${className ?? ''}${loaded ? ' is-loaded' : ''}`.trim()}
      draggable={false}
      decoding="async"
      loading="eager"
      fetchPriority={priority ? 'high' : 'low'}
      onLoad={() => {
        markShopBannerVisuallyReady(remoteUrl)
        setLoaded(true)
      }}
      onError={() => {
        setLoaded(false)
        if (attempt >= 4) return

        const nextAttempt = attempt + 1
        setAttempt(nextAttempt)

        if (src.startsWith('blob:') && remoteUrl) {
          setSrc(`${remoteUrl}${remoteUrl.includes('?') ? '&' : '?'}r=${nextAttempt}`)
          return
        }

        void ensureShopBannerSrc(url)
          .then((resolved) => {
            if (resolved && resolved !== src) {
              setSrc(
                resolved.startsWith('blob:')
                  ? resolved
                  : `${resolved}${resolved.includes('?') ? '&' : '?'}r=${Date.now()}`,
              )
              return
            }
            setSrc(`${remoteUrl}${remoteUrl.includes('?') ? '&' : '?'}r=${Date.now()}`)
          })
          .catch(() => {
            setSrc(`${remoteUrl}${remoteUrl.includes('?') ? '&' : '?'}r=${Date.now()}`)
          })
      }}
    />
  )
}
