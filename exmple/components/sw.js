const CACHE_VERSION = 'v5'
const HERO_CACHE = `viraltel-shop-heroes-${CACHE_VERSION}`
const FLAG_CACHE = `viraltel-country-flags-${CACHE_VERSION}`
const EMOJI_CACHE = `viraltel-apple-emojis-${CACHE_VERSION}`

const ASSETS = [
  '/shop-heroes/virtual-number/telephone-receiver-still.webp',
  '/shop-heroes/virtual-number/telephone-receiver.webp',
  '/shop-heroes/channel-views/eyes-still.webp',
  '/shop-heroes/channel-views/eyes.webp',
  '/shop-heroes/reaction/heart-on-fire-still.webp',
  '/shop-heroes/reaction/heart-on-fire.webp',
  '/shop-heroes/telegram-members/chart-increasing-still.webp',
  '/shop-heroes/telegram-members/chart-increasing.webp',
  '/shop-heroes/chatgpt/robot-still.webp',
  '/shop-heroes/chatgpt/robot.webp',
]

const FLAG_HOST = 'countryflagsapi.netlify.app'
const EMOJI_HOST = 'cdn.jsdelivr.net'
const EMOJI_PATH_PREFIX = '/npm/emoji-datasource-apple@16.0.0/img/apple/'

function isManagedCacheKey(key) {
  return (
    key.startsWith('viraltel-shop-heroes-') ||
    key.startsWith('viraltel-country-flags-') ||
    key.startsWith('viraltel-apple-emojis-') ||
    key.startsWith('numberstar-shop-heroes-') ||
    key.startsWith('numberstar-country-flags-') ||
    key.startsWith('numberstar-apple-emojis-')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(HERO_CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                isManagedCacheKey(key) &&
                key !== HERO_CACHE &&
                key !== FLAG_CACHE &&
                key !== EMOJI_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.pathname.startsWith('/shop-heroes/')) {
    event.respondWith(cacheFirst(request, HERO_CACHE))
    return
  }

  if (url.hostname === FLAG_HOST && url.pathname.startsWith('/flag/')) {
    event.respondWith(cacheFirst(request, FLAG_CACHE))
    return
  }

  if (url.hostname === EMOJI_HOST && url.pathname.startsWith(EMOJI_PATH_PREFIX)) {
    event.respondWith(cacheFirst(request, EMOJI_CACHE))
  }
})
