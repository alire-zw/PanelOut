import { MIN_PAYMENT_TOMAN } from './zibal.constants.js'

export function resolveWalletGatewaySplit(
  toman: number,
  balance: bigint,
  useWalletBalance: boolean,
): { walletAmount: bigint; gatewayAmount: bigint } {
  const total = BigInt(toman)

  if (!useWalletBalance || balance <= 0n) {
    return { walletAmount: 0n, gatewayAmount: total }
  }

  let walletAmount = balance < total ? balance : total
  let gatewayAmount = total - walletAmount

  if (gatewayAmount > 0n && gatewayAmount < MIN_PAYMENT_TOMAN) {
    if (total >= MIN_PAYMENT_TOMAN) {
      const maxWallet = total - MIN_PAYMENT_TOMAN
      walletAmount = balance < maxWallet ? balance : maxWallet
      gatewayAmount = total - walletAmount
    }

    if (gatewayAmount > 0n && gatewayAmount < MIN_PAYMENT_TOMAN) {
      walletAmount = 0n
      gatewayAmount = total
    }
  }

  return { walletAmount, gatewayAmount }
}
