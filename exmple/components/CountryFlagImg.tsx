import { useEffect, useState } from 'react'
import {
  getCachedCountryFlagSrcSync,
  resolveCountryFlagSrc,
} from '../lib/countryFlagCache'
import { getCountryFlagUrl } from '../lib/countryFlags'

interface CountryFlagImgProps {
  flagCode: string
  className?: string
  width?: number
  height?: number
  alt?: string
}

export function CountryFlagImg({
  flagCode,
  className,
  width = 24,
  height = 18,
  alt = '',
}: CountryFlagImgProps) {
  const code = flagCode.trim()
  const remoteUrl = code ? getCountryFlagUrl(code) : ''
  const [src, setSrc] = useState(() =>
    code ? getCachedCountryFlagSrcSync(code) ?? remoteUrl : '',
  )

  useEffect(() => {
    if (!code) {
      setSrc('')
      return
    }

    const remote = getCountryFlagUrl(code)
    const sync = getCachedCountryFlagSrcSync(code)
    setSrc(sync ?? remote)

    let cancelled = false
    void resolveCountryFlagSrc(code)
      .then((resolved) => {
        if (!cancelled && resolved) setSrc(resolved)
      })
      .catch(() => {
        if (!cancelled) setSrc(remote)
      })

    return () => {
      cancelled = true
    }
  }, [code])

  if (!code || !src) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          width,
          height,
          borderRadius: 3,
          background: 'color-mix(in srgb, var(--text-muted) 16%, transparent)',
        }}
        aria-hidden={alt ? undefined : true}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      decoding="async"
      draggable={false}
      onError={() => {
        if (src.startsWith('blob:') && remoteUrl) setSrc(remoteUrl)
      }}
    />
  )
}
