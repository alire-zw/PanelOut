import { env } from "../../config/env.js";

const EXPLORER_BASE = {
  mainnet: "https://tronscan.org/#/transaction/",
  shasta: "https://shasta.tronscan.org/#/transaction/",
};

export function getTronTxExplorerUrl(txHash) {
  const base = EXPLORER_BASE[env.tronNetwork] ?? EXPLORER_BASE.mainnet;
  return `${base}${txHash}`;
}
