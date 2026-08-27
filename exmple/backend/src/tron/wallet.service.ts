import { prisma } from '../db/client.js'
import { log } from '../lib/logger.js'
import { getTronWeb, getTronWebForPrivateKey } from '../tron/tron.client.js'
import { TRON_SUN_PER_TRX } from '../tron/tron.config.js'
import { env } from '../config/env.js'

export interface CreatedTronWallet {
  address: string
  publicKey: string
  privateKey: string
}

export async function generateTronWallet(): Promise<CreatedTronWallet> {
  const tronWeb = getTronWeb()
  const account = await tronWeb.createAccount()

  return {
    address: account.address.base58,
    publicKey: account.publicKey,
    privateKey: account.privateKey,
  }
}

export async function ensureUserTronWallet(userId: number) {
  const existing = await prisma.tronWallet.findUnique({ where: { userId } })
  if (existing) {
    return existing
  }

  const generated = await generateTronWallet()

  const wallet = await prisma.tronWallet.create({
    data: {
      userId,
      address: generated.address,
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    },
  })

  log.info('TRON', 'wallet created', { userId, address: wallet.address })
  return wallet
}

export async function getWalletBalanceSun(address: string): Promise<bigint> {
  const tronWeb = getTronWeb()
  const balance = await tronWeb.trx.getBalance(address)
  return BigInt(balance)
}

export async function sweepWalletBalance(
  address: string,
  privateKey: string,
): Promise<{ txId: string; amountSun: bigint } | null> {
  const balanceSun = await getWalletBalanceSun(address)

  if (balanceSun <= 0n) {
    return null
  }

  const tronWeb = getTronWebForPrivateKey(privateKey)
  const amountToSend = balanceSun

  const transaction = await tronWeb.transactionBuilder.sendTrx(
    env.TRON_MASTER_ADDRESS,
    Number(amountToSend),
    address,
  )

  const signed = await tronWeb.trx.sign(transaction)
  const broadcast = await tronWeb.trx.sendRawTransaction(signed)

  if (!broadcast.result) {
    const reserveSun = 1_000_000n
    if (balanceSun <= reserveSun) {
      throw new Error('Balance too low to sweep after bandwidth fee')
    }

    const fallbackAmount = balanceSun - reserveSun
    const fallbackTx = await tronWeb.transactionBuilder.sendTrx(
      env.TRON_MASTER_ADDRESS,
      Number(fallbackAmount),
      address,
    )
    const fallbackSigned = await tronWeb.trx.sign(fallbackTx)
    const fallbackBroadcast = await tronWeb.trx.sendRawTransaction(fallbackSigned)

    if (!fallbackBroadcast.result) {
      throw new Error(`Sweep failed: ${broadcast.code ?? 'unknown'}`)
    }

    log.info('TRON', 'wallet swept with reserve', {
      from: address,
      amountSun: fallbackAmount.toString(),
      txId: fallbackBroadcast.txid,
    })

    return { txId: fallbackBroadcast.txid, amountSun: fallbackAmount }
  }

  log.info('TRON', 'wallet swept', {
    from: address,
    amountSun: amountToSend.toString(),
    txId: broadcast.txid,
  })

  return { txId: broadcast.txid, amountSun: amountToSend }
}

export function sunToTrx(sun: bigint): string {
  const whole = sun / TRON_SUN_PER_TRX
  const fraction = sun % TRON_SUN_PER_TRX
  return `${whole}.${fraction.toString().padStart(6, '0').replace(/0+$/, '') || '0'}`
}

export async function ensureMissingUserWallets(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { tronWallet: null },
    select: { id: true },
    take: 100,
  })

  for (const user of users) {
    await ensureUserTronWallet(user.id)
  }

  return users.length
}
