import { TronWeb } from "tronweb";
import { env } from "../../config/env.js";

let tronWebInstance = null;

export function getTronWeb() {
  if (!tronWebInstance) {
    tronWebInstance = new TronWeb({
      fullHost: env.tronFullHost,
      headers: { "TRON-PRO-API-KEY": env.tronGridApiKey },
    });
  }

  return tronWebInstance;
}

export async function createTronAccount() {
  return TronWeb.createAccount();
}

export function getTronWebForPrivateKey(privateKey) {
  return new TronWeb({
    fullHost: env.tronFullHost,
    headers: { "TRON-PRO-API-KEY": env.tronGridApiKey },
    privateKey,
  });
}

export function isValidTronAddress(address) {
  return TronWeb.isAddress(address);
}

export function fromHexAddress(hexAddress) {
  return getTronWeb().address.fromHex(hexAddress);
}
