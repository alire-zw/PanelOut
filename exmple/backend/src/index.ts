import type { FastifyInstance } from 'fastify'
import type { Bot } from 'grammy'
import { env, webhookUrl } from './config/env.js'
import { prepareDatabase } from './db/setup.js'
import { formatError, log } from './lib/logger.js'

const state: {
  app: FastifyInstance | null
  bot: Bot | null
  shuttingDown: boolean
} = {
  app: null,
  bot: null,
  shuttingDown: false,
}

async function shutdown(signal?: string): Promise<void> {
  if (state.shuttingDown) {
    return
  }

  state.shuttingDown = true

  if (signal) {
    log.info('APP', `shutdown ${signal}`)
  }

  try {
    await state.app?.close()

    const { prisma } = await import('./db/client.js')
    const { disconnectRedis } = await import('./redis/client.js')
    const { stopTronWalletJob } = await import('./jobs/tron-wallet.job.js')
    const { stopVirtualNumberCountriesJob } = await import(
      './jobs/virtual-number-countries.job.js'
    )
    const { stopWebhookRetries } = await import('./bot/webhook.js')
    const { stopTelegramApiProxy } = await import('./bot/telegram-api-access.js')

    stopTronWalletJob()
    stopVirtualNumberCountriesJob()
    stopWebhookRetries()
    stopTelegramApiProxy()
    await prisma.$disconnect()
    await disconnectRedis()
  } catch (error) {
    log.error('APP', formatError(error))
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

async function bootstrap(): Promise<void> {
  log.info('APP', 'starting…', {
    env: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
  })

  log.info('DB', 'preparing schema…')
  await prepareDatabase()
  log.info('DB', 'ready', { name: env.DB_NAME })

  const { prisma } = await import('./db/client.js')
  const { connectRedis } = await import('./redis/client.js')
  const { buildApp } = await import('./api/app.js')
  const { resolveTelegramApiRoot, getTelegramApiRoot } = await import(
    './bot/telegram-api-access.js'
  )
  const { createBot } = await import('./bot/index.js')
  const { registerBotWebhook, setupTelegramWebhook, keepTryingTelegramWebhook } = await import(
    './bot/webhook.js'
  )
  const { startTronWalletJob } = await import('./jobs/tron-wallet.job.js')
  const { startVirtualNumberCountriesJob } = await import(
    './jobs/virtual-number-countries.job.js'
  )
  const { refreshVirtualNumberCountryGroups } = await import(
    './virtual-number/virtual-number-countries.service.js'
  )

  log.info('REDIS', 'connecting…')
  await connectRedis()
  log.info('REDIS', 'connected')

  log.info('DB', 'connecting Prisma…')
  await prisma.$connect()
  log.info('DB', 'Prisma connected')

  const { seedShopCategories } = await import('./orders/shop-category.seed.js')
  await seedShopCategories()
  log.info('APP', 'shop categories seeded')

  await resolveTelegramApiRoot()

  state.bot = createBot()
  state.app = await buildApp()

  registerBotWebhook(state.app, state.bot)

  await state.app.listen({ host: env.HOST, port: env.PORT })
  log.info('APP', 'HTTP server listening', {
    host: env.HOST,
    port: env.PORT,
  })

  let botUsername = 'unknown'
  let webhookOk = false
  try {
    const me = await setupTelegramWebhook(state.bot)
    botUsername = me.username
    webhookOk = true
  } catch (error) {
    log.error('WEBHOOK', formatError(error), {
      webhook: webhookUrl,
      api: getTelegramApiRoot(),
      note: 'will keep retrying in background',
    })
    keepTryingTelegramWebhook(state.bot)
  }

  try {
    log.info('APP', 'warming virtual number countries cache…')
    const groups = await refreshVirtualNumberCountryGroups(true)
    const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0)
    log.info('APP', 'virtual number countries cache warmed', {
      groups: groups.length,
      countries: itemCount,
    })
  } catch (error) {
    log.error('APP', 'virtual number countries cache warm failed', {
      error: formatError(error),
    })
  }

  startTronWalletJob()
  startVirtualNumberCountriesJob()

  log.banner(webhookOk ? 'ready' : 'ready (webhook NOT set)', {
    db: env.DB_NAME,
    port: env.PORT,
    bot: `@${botUsername}`,
    webhook: webhookUrl,
    tronNetwork: env.TRON_NETWORK,
  })
}

bootstrap().catch((error) => {
  log.error('APP', formatError(error) || 'Failed to start application')
  process.exit(1)
})
