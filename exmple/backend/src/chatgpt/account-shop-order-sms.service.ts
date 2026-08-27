import { env } from '../config/env.js'
import { log } from '../lib/logger.js'
import { prisma } from '../db/client.js'
import { sendSmsIrVerify } from '../kyc/smsir.client.js'

function normalizeMobile(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('09')) return digits
  if (digits.length === 12 && digits.startsWith('989')) return `0${digits.slice(2)}`
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`
  return null
}

async function sendAccountOrderSms(input: {
  userId: number
  orderId: string
  templateId: number
  kind: 'received' | 'delivered'
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { phoneNumber: true },
    })
    const mobile = normalizeMobile(user?.phoneNumber)
    if (!mobile) {
      log.warn('ACCOUNT_SHOP_SMS', 'skip sms: no phone', {
        userId: input.userId,
        orderId: input.orderId,
        kind: input.kind,
      })
      return
    }

    await sendSmsIrVerify({
      mobile,
      templateId: input.templateId,
      parameters: [
        {
          name: env.SMSIR_ACCOUNT_ORDER_PARAM_NAME,
          value: input.orderId,
        },
      ],
    })

    log.info('ACCOUNT_SHOP_SMS', 'sent', {
      userId: input.userId,
      orderId: input.orderId,
      kind: input.kind,
      templateId: input.templateId,
    })
  } catch (error) {
    log.error('ACCOUNT_SHOP_SMS', 'send failed', {
      userId: input.userId,
      orderId: input.orderId,
      kind: input.kind,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}

export async function sendAccountShopOrderReceivedSms(userId: number, orderId: string) {
  await sendAccountOrderSms({
    userId,
    orderId,
    templateId: env.SMSIR_ACCOUNT_ORDER_RECEIVED_TEMPLATE_ID,
    kind: 'received',
  })
}

export async function sendAccountShopOrderDeliveredSms(userId: number, orderId: string) {
  if (
    env.SMSIR_ACCOUNT_ORDER_DELIVERED_TEMPLATE_ID === env.SMSIR_ACCOUNT_ORDER_RECEIVED_TEMPLATE_ID
  ) {
    log.warn('ACCOUNT_SHOP_SMS', 'delivered template equals received template — set SMSIR_ACCOUNT_ORDER_DELIVERED_TEMPLATE_ID', {
      orderId,
      templateId: env.SMSIR_ACCOUNT_ORDER_DELIVERED_TEMPLATE_ID,
    })
  }

  await sendAccountOrderSms({
    userId,
    orderId,
    templateId: env.SMSIR_ACCOUNT_ORDER_DELIVERED_TEMPLATE_ID,
    kind: 'delivered',
  })
}
