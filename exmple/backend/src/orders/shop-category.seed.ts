import { prisma } from '../db/client.js'
import { SHOP_CATEGORIES } from './shop-category.data.js'

export async function seedShopCategories(): Promise<void> {
  for (const category of SHOP_CATEGORIES) {
    await prisma.shopCategory.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        label: category.label,
        gradient: category.gradient,
        iconKey: category.iconKey,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      update: {
        label: category.label,
        gradient: category.gradient,
        iconKey: category.iconKey,
        sortOrder: category.sortOrder,
      },
    })
  }
}
