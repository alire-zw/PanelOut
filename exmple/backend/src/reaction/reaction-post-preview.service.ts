import { telegramWebFetch } from '../bot/telegram-api-access.js'

export class ReactionPostPreviewError extends Error {
  readonly code: 'INVALID_LINK' | 'PRIVATE_POST' | 'NOT_FOUND' | 'FETCH_FAILED'

  constructor(message: string, code: ReactionPostPreviewError['code']) {
    super(message)
    this.name = 'ReactionPostPreviewError'
    this.code = code
  }
}

export type ParsedTelegramPostLink = {
  username: string
  messageId: number
  canonicalUrl: string
}

export type ReactionPostMediaType =
  | 'text'
  | 'photo'
  | 'video'
  | 'animation'
  | 'sticker'
  | 'audio'
  | 'voice'
  | 'document'
  | 'poll'
  | 'location'
  | 'contact'
  | 'unknown'

export type ReactionPostPreview = {
  username: string
  messageId: number
  link: string
  title: string
  text: string
  photo: string
  mediaType: ReactionPostMediaType
  preview: string
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

function extractAttr(html: string, className: string, attr: string): string | null {
  const classPattern = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `<[^>]*class="[^"]*${classPattern}[^"]*"[^>]*${attr}=["']([^"']+)["'][^>]*>|<[^>]*${attr}=["']([^"']+)["'][^>]*class="[^"]*${classPattern}[^"]*"[^>]*>`,
    'i',
  )
  const match = html.match(regex)
  return match?.[1] || match?.[2] || null
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

function hasClass(html: string, className: string): boolean {
  const classPattern = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`class="[^"]*${classPattern}[^"]*"`, 'i').test(html)
}

function detectMediaType(html: string): ReactionPostMediaType {
  if (hasClass(html, 'tgme_widget_message_sticker')) return 'sticker'
  if (hasClass(html, 'tgme_widget_message_voice') || hasClass(html, 'tgme_widget_message_voice_player')) {
    return 'voice'
  }
  if (
    hasClass(html, 'tgme_widget_message_audio') ||
    (hasClass(html, 'tgme_widget_message_document') &&
      /audio|music|mp3|ogg|flac|m4a/i.test(
        extractInnerByClass(html, 'tgme_widget_message_document_extra') ??
          extractAttr(html, 'tgme_widget_message_document', 'href') ??
          '',
      ))
  ) {
    return 'audio'
  }
  if (hasClass(html, 'tgme_widget_message_poll')) return 'poll'
  if (hasClass(html, 'tgme_widget_message_location')) return 'location'
  if (hasClass(html, 'tgme_widget_message_contact')) return 'contact'
  if (
    hasClass(html, 'tgme_widget_message_animation') ||
    hasClass(html, 'tgme_widget_message_gif')
  ) {
    return 'animation'
  }
  if (
    hasClass(html, 'tgme_widget_message_video') ||
    hasClass(html, 'tgme_widget_message_video_player') ||
    hasClass(html, 'tgme_widget_message_roundvideo')
  ) {
    return 'video'
  }
  if (
    hasClass(html, 'tgme_widget_message_photo') ||
    hasClass(html, 'tgme_widget_message_photo_wrap')
  ) {
    return 'photo'
  }
  if (hasClass(html, 'tgme_widget_message_document')) return 'document'
  if (hasClass(html, 'tgme_widget_message_text')) return 'text'
  return 'unknown'
}

function buildPreviewLabel(input: {
  mediaType: ReactionPostMediaType
  text: string
  html: string
}): string {
  const documentTitle = stripHtml(extractInnerByClass(input.html, 'tgme_widget_message_document_title') ?? '')
  const documentExtra = stripHtml(extractInnerByClass(input.html, 'tgme_widget_message_document_extra') ?? '')
  const pollQuestion = stripHtml(extractInnerByClass(input.html, 'tgme_widget_message_poll_question') ?? '')

  if (input.mediaType === 'sticker') return 'استیکر'
  if (input.mediaType === 'voice') return 'پیام صوتی'
  if (input.mediaType === 'location') return 'موقعیت مکانی'
  if (input.mediaType === 'contact') return 'مخاطب'
  if (input.mediaType === 'poll') return pollQuestion || 'نظرسنجی'

  if (input.mediaType === 'audio') {
    if (documentTitle && documentExtra) return `${documentTitle} — ${documentExtra}`
    return documentTitle || 'موزیک'
  }

  if (input.mediaType === 'document') {
    return documentTitle || 'فایل'
  }

  if (input.text) return input.text

  if (input.mediaType === 'photo') return 'عکس'
  if (input.mediaType === 'video') return 'ویدیو'
  if (input.mediaType === 'animation') return 'گیف'
  if (input.mediaType === 'text') return 'متن'

  return 'پست'
}

export function parseTelegramPostLink(rawLink: string): ParsedTelegramPostLink {
  const trimmed = rawLink.trim()
  if (!trimmed) {
    throw new ReactionPostPreviewError('لینک پست را وارد کنید', 'INVALID_LINK')
  }

  let normalized = trimmed
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized.replace(/^\/+/, '')}`
  }

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new ReactionPostPreviewError('لینک پست معتبر نیست', 'INVALID_LINK')
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 't.me' && host !== 'telegram.me' && host !== 'telegram.dog') {
    throw new ReactionPostPreviewError('فقط لینک پست تلگرام پذیرفته می‌شود', 'INVALID_LINK')
  }

  const parts = url.pathname
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts[0]?.toLowerCase() === 'c') {
    throw new ReactionPostPreviewError(
      'فقط پست کانال‌های عمومی پشتیبانی می‌شود',
      'PRIVATE_POST',
    )
  }

  const usernameIndex = parts[0]?.toLowerCase() === 's' ? 1 : 0
  const username = parts[usernameIndex]
  const messageIdRaw = parts[usernameIndex + 1]

  if (!username || !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) {
    throw new ReactionPostPreviewError('لینک پست معتبر نیست', 'INVALID_LINK')
  }

  const messageId = Number.parseInt(messageIdRaw ?? '', 10)
  if (!Number.isFinite(messageId) || messageId <= 0) {
    throw new ReactionPostPreviewError('لینک باید مربوط به یک پست باشد', 'INVALID_LINK')
  }

  return {
    username,
    messageId,
    canonicalUrl: `https://t.me/${username}/${messageId}`,
  }
}

export async function fetchReactionPostPreview(rawLink: string): Promise<ReactionPostPreview> {
  const parsed = parseTelegramPostLink(rawLink)
  const embedUrl = `${parsed.canonicalUrl}?embed=1&mode=tme`

  let html: string
  try {
    const response = await telegramWebFetch(embedUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent':
          'Mozilla/5.0 (compatible; ViralTelBot/1.0; +https://t.me)',
      },
    })

    if (!response.ok) {
      throw new ReactionPostPreviewError('دریافت پست ناموفق بود', 'FETCH_FAILED')
    }

    html = await response.text()
  } catch (error) {
    if (error instanceof ReactionPostPreviewError) throw error
    throw new ReactionPostPreviewError('دریافت پست ناموفق بود', 'FETCH_FAILED')
  }

  if (
    html.includes('tgme_page_error') ||
    html.includes('If you have <strong>Telegram</strong>, you can view') ||
    !html.includes('tgme_widget_message')
  ) {
    throw new ReactionPostPreviewError('پست پیدا نشد یا خصوصی است', 'NOT_FOUND')
  }

  const titleHtml =
    extractInnerByClass(html, 'tgme_widget_message_owner_name') ??
    extractInnerByClass(html, 'tgme_widget_message_author')
  const title = titleHtml ? stripHtml(titleHtml) : parsed.username

  const textHtml = extractInnerByClass(html, 'tgme_widget_message_text')
  const text = textHtml ? stripHtml(textHtml) : ''
  const mediaType = detectMediaType(html)
  const preview = buildPreviewLabel({ mediaType, text, html })

  const userPhoto =
    extractAttr(html, 'tgme_widget_message_user_photo', 'src') ??
    html.match(/class="tgme_widget_message_user_photo[^"]*"[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)?.[1]

  const mediaPhoto =
    extractBackgroundImageUrl(
      extractInnerByClass(html, 'tgme_widget_message_photo_wrap') ??
        extractInnerByClass(html, 'tgme_widget_message_video_thumb') ??
        '',
    ) ??
    html.match(/class="[^"]*tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*url\(['"]?([^'")]+)['"]?\)/i)?.[1] ??
    html.match(/class="[^"]*tgme_widget_message_video_thumb[^"]*"[^>]*style="[^"]*url\(['"]?([^'")]+)['"]?\)/i)?.[1]

  const photo = normalizePhotoUrl(userPhoto || mediaPhoto)

  return {
    username: parsed.username,
    messageId: parsed.messageId,
    link: parsed.canonicalUrl,
    title: title || parsed.username,
    text,
    photo,
    mediaType,
    preview,
  }
}
