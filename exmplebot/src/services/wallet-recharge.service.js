import {
  reactivateSuspendedUsageSubscriptions,
  runOutboundUsageBillingForUser,
} from "./outbound-usage-billing.service.js";
import {
  reactivateSuspendedPanelUsageSubscriptions,
  runPanelUsageBillingForUser,
} from "./panel-usage-billing.service.js";
import { prisma } from "../db/prisma.js";

export async function handleUserWalletRecharged(userId) {
  const user = await prisma.user.findUnique({
    where: { userId: BigInt(userId) },
  });

  if (!user || user.balance <= 0n) {
    return;
  }

  await reactivateSuspendedUsageSubscriptions(userId, user.balance);
  await reactivateSuspendedPanelUsageSubscriptions(userId, user.balance);

  await runOutboundUsageBillingForUser(userId);
  await runPanelUsageBillingForUser(userId);
}
