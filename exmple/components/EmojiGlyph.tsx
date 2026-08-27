import { useEffect, useState, type CSSProperties, type ImgHTMLAttributes } from 'react'
import { appleEmojiPngUrl } from '../lib/appleEmoji'
import {
  getCachedAppleEmojiSrcSync,
  resolveAppleEmojiSrc,
} from '../lib/appleEmojiCache'

type EmojiGlyphProps = {
  emoji: string
  size?: number
  className?: string
  title?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'>

/**
 * Renders Apple Color Emoji images on every device.
 * Uses IndexedDB blob cache (same pattern as country flags) so images are not
 * re-downloaded on every visit.
 */
export function EmojiGlyph({
  emoji,
  size = 16,
  className,
  title,
  style,
  ...imgProps
}: EmojiGlyphProps) {
  const remoteUrl = emoji ? appleEmojiPngUrl(emoji) : null
  const [src, setSrc] = useState(() =>
    emoji ? getCachedAppleEmojiSrcSync(emoji) ?? remoteUrl ?? '' : '',
  )

  useEffect(() => {
    if (!emoji) {
      setSrc('')
      return
    }

    const remote = appleEmojiPngUrl(emoji)
    const sync = getCachedAppleEmojiSrcSync(emoji)
    setSrc(sync ?? remote ?? '')

    if (!remote) return

    let cancelled = false
    void resolveAppleEmojiSrc(emoji)
      .then((resolved) => {
        if (!cancelled && resolved) setSrc(resolved)
      })
      .catch(() => {
        if (!cancelled && remote) setSrc(remote)
      })

    return () => {
      cancelled = true
    }
  }, [emoji])

  if (!emoji) return null

  if (!src) {
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }} title={title}>
        {emoji}
      </span>
    )
  }

  const imgStyle: CSSProperties = {
    width: size,
    height: size,
    display: 'inline-block',
    objectFit: 'contain',
    verticalAlign: 'middle',
    ...style,
  }

  return (
    <img
      {...imgProps}
      className={className}
      src={src}
      alt=""
      title={title}
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      style={imgStyle}
      onError={() => {
        if (src.startsWith('blob:') && remoteUrl) setSrc(remoteUrl)
      }}
    />
  )
}
