import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

const PRICE_CACHE_TTL_MS = 30_000;
let cachedTrxPriceIrt = null;
let cachedAt = 0;

function extractPrices(payload) {
  if (payload?.result && typeof payload.result === "object") {
    return payload.result;
  }

  return payload;
}

export async function getTrxPriceIrt() {
  if (cachedTrxPriceIrt && Date.now() - cachedAt < PRICE_CACHE_TTL_MS) {
    return cachedTrxPriceIrt;
  }

  const response = await fetch("https://swapwallet.app/api/v1/market/prices", {
    headers: {
      Authorization: `Bearer ${env.swapwalletApiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`SwapWallet prices failed: ${response.status}`);
  }

  const payload = await response.json();
  const prices = extractPrices(payload);
  const rawPrice = prices["TRX/IRT"];

  if (!rawPrice) {
    throw new Error("TRX/IRT price not found in SwapWallet response");
  }

  const price = Number(rawPrice);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid TRX/IRT price: ${rawPrice}`);
  }

  cachedTrxPriceIrt = BigInt(Math.floor(price));
  cachedAt = Date.now();

  logger.debug("pricing", `TRX/IRT ${cachedTrxPriceIrt}`);

  return cachedTrxPriceIrt;
}

export function calculateIrtFromSun(amountSun, trxPriceIrt) {
  const amountTrx = Number(amountSun) / 1_000_000;
  return BigInt(Math.floor(amountTrx * Number(trxPriceIrt)));
}
