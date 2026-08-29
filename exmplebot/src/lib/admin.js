import { env } from "../config/env.js";

export function isAdminUser(userId) {
  return env.adminIds.has(Number(userId));
}
