import { prisma } from '../db/client.js'
import { buildVirtualNumberOrderId } from '../orders/order.constants.js'

const SAMPLE_CALLINOO_RESPONSE = {
  number: '1234567890',
  order_id: 987654321,
  price: 3500,
  countery: '🇺🇸 امریکا',
  range: '1',
  service: 'تلگرام (پنل اختصاصی)',
  quality: 'سالم بدون ریپورت',
} as const

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ orderBy: { id: 'asc' } })
  if (!user) {
    throw new Error('No user found to attach the test virtual number order')
  }

  const category = await prisma.shopCategory.findUnique({
    where: { slug: 'virtual-number' },
  })
  if (!category) {
    throw new Error('Shop category "virtual-number" not found. Start the app once to seed categories.')
  }

  const existing = await prisma.virtualNumber.findFirst({
    where: { providerOrderId: String(SAMPLE_CALLINOO_RESPONSE.order_id) },
    include: { order: true },
  })

  if (existing) {
    console.log('Test virtual number purchase already exists:', {
      orderId: existing.order.orderId,
      providerOrderId: existing.providerOrderId,
      number: existing.number,
    })
    return
  }

  const tempOrderId = `VB-TEMP-${user.id}-${Date.now()}`

  const order = await prisma.order.create({
    data: {
      orderId: tempOrderId,
      userId: user.id,
      categoryId: category.id,
      status: 'completed',
      paymentMethod: 'wallet',
      amountToman: BigInt(SAMPLE_CALLINOO_RESPONSE.price),
      fulfilledAt: new Date(),
    },
  })

  const orderId = buildVirtualNumberOrderId(order.id)

  const [updatedOrder, purchase] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { orderId },
    }),
    prisma.virtualNumber.create({
      data: {
        orderDbId: order.id,
        providerOrderId: String(SAMPLE_CALLINOO_RESPONSE.order_id),
        number: SAMPLE_CALLINOO_RESPONSE.number,
        price: BigInt(SAMPLE_CALLINOO_RESPONSE.price),
        country: SAMPLE_CALLINOO_RESPONSE.countery,
        range: SAMPLE_CALLINOO_RESPONSE.range,
        service: SAMPLE_CALLINOO_RESPONSE.service,
        quality: SAMPLE_CALLINOO_RESPONSE.quality,
      },
    }),
  ])

  console.log('Inserted test virtual number purchase:', {
    orderId: updatedOrder.orderId,
    userId: user.id,
    providerOrderId: purchase.providerOrderId,
    number: purchase.number,
    country: purchase.country,
    quality: purchase.quality,
  })
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
