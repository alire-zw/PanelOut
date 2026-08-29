import { prisma } from "../db/prisma.js";
import {
  getTehranRollingMonthStart,
  getTehranRollingWeekStart,
  getTehranStartOfDay,
} from "../lib/tehran-time.js";

export async function getUserStats() {
  const dayStart = getTehranStartOfDay();
  const weekStart = getTehranRollingWeekStart();
  const monthStart = getTehranRollingMonthStart();

  const [total, premium, today, week, month] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({ where: { dateCreated: { gte: dayStart } } }),
    prisma.user.count({ where: { dateCreated: { gte: weekStart } } }),
    prisma.user.count({ where: { dateCreated: { gte: monthStart } } }),
  ]);

  return { total, premium, today, week, month };
}
