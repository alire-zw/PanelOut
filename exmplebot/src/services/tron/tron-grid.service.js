import { env } from "../../config/env.js";
import { fromHexAddress } from "./tron.client.js";

export async function fetchIncomingTransactions(address, limit = 50) {
  const params = new URLSearchParams({
    only_to: "true",
    only_confirmed: "true",
    limit: String(limit),
  });

  const response = await fetch(
    `${env.tronFullHost}/v1/accounts/${address}/transactions?${params}`,
    {
      headers: { "TRON-PRO-API-KEY": env.tronGridApiKey },
    },
  );

  if (!response.ok) {
    throw new Error(`TronGrid request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.data ?? [];
}

export function parseTrxTransfer(tx, walletAddress) {
  const contract = tx.raw_data?.contract?.[0];

  if (!contract || contract.type !== "TransferContract") {
    return null;
  }

  if (tx.ret?.[0]?.contractRet !== "SUCCESS") {
    return null;
  }

  const value = contract.parameter?.value;

  if (!value?.amount) {
    return null;
  }

  const toAddress = fromHexAddress(value.to_address);

  if (toAddress !== walletAddress) {
    return null;
  }

  const amountSun = BigInt(value.amount);

  if (amountSun <= 0n) {
    return null;
  }

  return {
    txHash: tx.txID,
    fromAddress: fromHexAddress(value.owner_address),
    toAddress,
    amountSun,
    amountTrx: (Number(amountSun) / 1_000_000).toFixed(6),
    blockNumber: tx.blockNumber ? BigInt(tx.blockNumber) : null,
    blockTimestamp: tx.block_timestamp ? new Date(tx.block_timestamp) : null,
  };
}
