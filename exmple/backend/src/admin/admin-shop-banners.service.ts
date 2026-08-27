import { randomUUID } from 'node:crypto'
import { mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { prisma } from '../db/client.js'
import {
  buildShopBannersVersion,
  invalidateActiveShopBannersCache,
  readActiveShopBannersCache,
  writeActiveShopBannersCache,
  type ShopBannersPayload,
} from './admin-shop-banners.cache.js'
import type { CreateShopBannerInput, UpdateShopBannerInput } from './admin-shop-banners.schema.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const SHOP_BANNERS_UPLOAD_DIR = path.join(backendRoot, 'uploads', 'shop-banners')
const PUBLIC_PREFIX = '/uploads/shop-banners'

export type ShopBannerDto = {
  id: number
  title: string
  productKey: string
  mainImageUrl: string
  thumbImageUrl: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function serializeBanner(banner: {
  id: number
  title: string
  productKey: string
  mainImageUrl: string
  thumbImageUrl: string
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): ShopBannerDto {
  return {
    id: banner.id,
    title: banner.title,
    productKey: banner.productKey,
    mainImageUrl: banner.mainImageUrl,
    thumbImageUrl: banner.thumbImageUrl,
    sortOrder: banner.sortOrder,
    isActive: banner.isActive,
    createdAt: banner.createdAt.toISOString(),
    updatedAt: banner.updatedAt.toISOString(),
  }
}

function parseDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(dataUrl)
  if (!match?.[2]) {
    throw new Error('فرمت تصویر نامعتبر است')
  }
  return Buffer.from(match[2], 'base64')
}

async function ensureUploadDir(): Promise<void> {
  await mkdir(SHOP_BANNERS_UPLOAD_DIR, { recursive: true })
}

async function saveAsWebp(
  dataUrl: string,
  kind: 'main' | 'thumb',
): Promise<{ fileName: string; publicUrl: string }> {
  const input = parseDataUrl(dataUrl)
  await ensureUploadDir()

  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${kind}.webp`
  const filePath = path.join(SHOP_BANNERS_UPLOAD_DIR, fileName)

  const pipeline = sharp(input).rotate()
  if (kind === 'main') {
    pipeline.resize({
      width: 1125,
      height: 420,
      fit: 'cover',
      position: 'centre',
    })
  } else {
    pipeline.resize({
      width: 210,
      height: 210,
      fit: 'cover',
      position: 'centre',
    })
  }

  await pipeline.webp({ quality: 82 }).toFile(filePath)

  return {
    fileName,
    publicUrl: `${PUBLIC_PREFIX}/${fileName}`,
  }
}

function urlToFilePath(publicUrl: string): string | null {
  if (!publicUrl.startsWith(`${PUBLIC_PREFIX}/`)) return null
  const fileName = path.basename(publicUrl)
  if (!fileName || fileName.includes('..')) return null
  return path.join(SHOP_BANNERS_UPLOAD_DIR, fileName)
}

async function deleteImageFile(publicUrl: string): Promise<void> {
  const filePath = urlToFilePath(publicUrl)
  if (!filePath) return
  try {
    await unlink(filePath)
  } catch {
    // ignore missing files
  }
}

export async function listShopBannersAdmin() {
  const items = await prisma.shopBanner.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
  })
  return { items: items.map(serializeBanner) }
}

async function loadActiveShopBannersFromDb(): Promise<ShopBannersPayload> {
  const rows = await prisma.shopBanner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
  })
  const items = rows.map(serializeBanner)
  return {
    version: buildShopBannersVersion(items),
    cachedAt: new Date().toISOString(),
    items,
  }
}

export async function listActiveShopBanners(): Promise<ShopBannersPayload> {
  const cached = await readActiveShopBannersCache()
  if (cached) return cached

  const payload = await loadActiveShopBannersFromDb()
  await writeActiveShopBannersCache(payload)
  return payload
}

export async function syncActiveShopBanners(version?: string): Promise<
  ShopBannersPayload & { changed: boolean }
> {
  const payload = await listActiveShopBanners()
  if (version && version === payload.version) {
    return { ...payload, changed: false }
  }
  return { ...payload, changed: true }
}

export async function createShopBanner(input: CreateShopBannerInput) {
  const [main, thumb] = await Promise.all([
    saveAsWebp(input.mainImage, 'main'),
    saveAsWebp(input.thumbImage, 'thumb'),
  ])

  try {
    const maxSort = await prisma.shopBanner.aggregate({ _max: { sortOrder: true } })
    const sortOrder = input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1

    const banner = await prisma.shopBanner.create({
      data: {
        title: input.title,
        productKey: input.productKey,
        mainImageUrl: main.publicUrl,
        thumbImageUrl: thumb.publicUrl,
        sortOrder,
        isActive: input.isActive ?? true,
      },
    })

    await invalidateActiveShopBannersCache()
    return { banner: serializeBanner(banner) }
  } catch (error) {
    await Promise.all([deleteImageFile(main.publicUrl), deleteImageFile(thumb.publicUrl)])
    throw error
  }
}

export async function updateShopBanner(id: number, input: UpdateShopBannerInput) {
  const existing = await prisma.shopBanner.findUnique({ where: { id } })
  if (!existing) return null

  const banner = await prisma.shopBanner.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.productKey !== undefined ? { productKey: input.productKey } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })

  await invalidateActiveShopBannersCache()
  return { banner: serializeBanner(banner) }
}

export async function deleteShopBanner(id: number) {
  const existing = await prisma.shopBanner.findUnique({ where: { id } })
  if (!existing) return null

  await prisma.shopBanner.delete({ where: { id } })
  await Promise.all([
    deleteImageFile(existing.mainImageUrl),
    deleteImageFile(existing.thumbImageUrl),
  ])
  await invalidateActiveShopBannersCache()

  return { ok: true as const }
}
