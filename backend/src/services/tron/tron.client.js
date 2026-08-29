import { TronWeb } from "tronweb";
import { config } from "../../config.js";

let tronWebInstance = null;

export function isTronConfigured() {
  return config.tronConfigured;
}

export function getTronWeb() {
  if (!config.tronConfigured) {
    throw new Error("TRON is not configured");
  }

  if (!tronWebInstance) {
    tronWebInstance = new TronWeb({
      fullHost: config.tronFullHost,
      headers: { "TRON-PRO-API-KEY": config.tronGridApiKey },
    });
  }

  return tronWebInstance;
}

export async function createTronAccount() {
  return TronWeb.createAccount();
}

export function getTronWebForPrivateKey(privateKey) {
  return new TronWeb({
    fullHost: config.tronFullHost,
    headers: { "TRON-PRO-API-KEY": config.tronGridApiKey },
    privateKey,
  });
}

export function isValidTronAddress(address) {
  return TronWeb.isAddress(address);
}

export function fromHexAddress(hexAddress) {
  return getTronWeb().address.fromHex(hexAddress);
}
