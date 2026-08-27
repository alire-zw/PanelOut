import { telegramWebFetch } from '../bot/telegram-api-access.js'

export class TelegramMembersChannelPreviewError extends Error {
  readonly code: 'INVALID_LINK' | 'PRIVATE_CHANNEL' | 'NOT_FOUND' | 'FETCH_FAILED'

  constructor(message: string, code: TelegramMembersChannelPreviewError['code']) {
    super(message)
    this.name = 'TelegramMembersChannelPreviewError'
    this.code = code
  }
}

export type TelegramMembersChannelPreview = {
  username: string
  link: string
  title: string
  photo: string
  subscribers: string
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function extractInnerByClass(html: string, className: string): string | null {
  const classPattern = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `<[^>]*class="[^"]*${classPattern}[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:div|span|a|i)>`,
    'i',
  )
  const match = html.match(regex)
  return match?.[1] ?? null
}

function extractBackgroundImageUrl(html: string): string | null {
  const match = html.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i)
  return match?.[1] ?? null
}

function normalizePhotoUrl(value: string | null | undefined): string {
  const photo = value?.trim() ?? ''
  if (!photo) return ''
  if (photo.startsWith('//')) return `https:${photo}`
  return photo
}

export function parseTelegramChannelLink(rawLink: string): {
  username: string
  canonicalUrl: string
} {
  const trimmed = rawLink.trim()
  if (!trimmed) {
    throw new TelegramMembersChannelPreviewError('لینک کانال را وارد کنید', 'INVALID_LINK')
  }

  let normalized = trimmed
  if (normalized.startsWith('@')) {
    normalized = `https://t.me/${normalized.slice(1)}`
  } else if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized.replace(/^\/+/, '')}`
  }

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new TelegramMembersChannelPreviewError('لینک کانال معتبر نیست', 'INVALID_LINK')
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 't.me' && host !== 'telegram.me' && host !== 'telegram.dog') {
    throw new TelegramMembersChannelPreviewError('فقط لینک کانال تلگرام پذیرفته می‌شود', 'INVALID_LINK')
  }

  const parts = url.pathname
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts[0]?.toLowerCase() === 'c') {
    throw new TelegramMembersChannelPreviewError(
      'فقط کانال‌های عمومی پشتیبانی می‌شوند',
      'PRIVATE_CHANNEL',
    )
  }

  // Accept t.me/username or t.me/s/username — ignore trailing post id if present
  let username = ''
  if (parts[0]?.toLowerCase() === 's' && parts[1]) {
    username = parts[1]
  } else if (parts[0]) {
    username = parts[0]
  }

  username = username.replace(/^@/, '').trim()
  if (!username || !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) {
    throw new TelegramMembersChannelPreviewError('لینک کانال معتبر نیست', 'INVALID_LINK')
  }

  // Reject reserved paths
  const reserved = new Set([
    'share',
    'joinchat',
    'addstickers',
    'proxy',
    'socks',
    'setlanguage',
    'iv',
    'login',
  ])
  if (reserved.has(username.toLowerCase())) {
    throw new TelegramMembersChannelPreviewError('لینک کانال معتبر نیست', 'INVALID_LINK')
  }

  return {
    username: username.toLowerCase(),
    canonicalUrl: `https://t.me/${username}`,
  }
}

export async function fetchTelegramMembersChannelPreview(
  rawLink: string,
): Promise<TelegramMembersChannelPreview> {
  const parsed = parseTelegramChannelLink(rawLink)

  let response: Response
  try {
    response = await telegramWebFetch(parsed.canonicalUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
  } catch {
    throw new TelegramMembersChannelPreviewError('دریافت کانال ناموفق بود', 'FETCH_FAILED')
  }

  if (!response.ok) {
    throw new TelegramMembersChannelPreviewError('دریافت کانال ناموفق بود', 'FETCH_FAILED')
  }

  const html = await response.text()

  const titleHtml = extractInnerByClass(html, 'tgme_page_title')
  const title = titleHtml ? stripHtml(titleHtml) : ''

  if (!title) {
    throw new TelegramMembersChannelPreviewError('کانال پیدا نشد یا خصوصی است', 'NOT_FOUND')
  }

  const extraHtml = extractInnerByClass(html, 'tgme_page_extra')
  const subscribers = extraHtml ? stripHtml(extraHtml) : ''

  const photoFromImg = html.match(
    /<img[^>]*class="[^"]*tgme_page_photo_image[^"]*"[^>]*src=["']([^"']+)["']/i,
  )?.[1]
  const photoWrap = extractInnerByClass(html, 'tgme_page_photo')
  const photoFromBg = photoWrap ? extractBackgroundImageUrl(photoWrap) : null
  const photo = normalizePhotoUrl(photoFromImg || photoFromBg)

  return {
    username: parsed.username,
    link: parsed.canonicalUrl,
    title,
    photo,
    subscribers,
  }
}
