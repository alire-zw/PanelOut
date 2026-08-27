import { createHmac } from "node:crypto";
import { config } from "../config.js";
import { safeEqualString } from "./security.js";

function signingKey() {
  return createHmac("sha256", "PanelOutUploadSign")
    .update(`${config.botToken}:${config.webhookSecret}`)
    .digest();
}

export function signUploadAccess(relativePath, telegramUserId, ttlSec = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const uid = String(telegramUserId);
  const payload = `${relativePath}\n${uid}\n${exp}`;
  const sig = createHmac("sha256", signingKey()).update(payload).digest("hex");
  const qs = new URLSearchParams({ uid, exp: String(exp), sig });
  return `/uploads/${relativePath}?${qs.toString()}`;
}

export function verifyUploadAccess(relativePath, { uid, exp, sig }) {
  const expires = Number(exp);
  if (!uid || !sig || !Number.isFinite(expires)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;

  const payload = `${relativePath}\n${uid}\n${expires}`;
  const expected = createHmac("sha256", signingKey()).update(payload).digest("hex");
  return safeEqualString(expected, sig);
}

export function attachSignedReceiptUrl(charge, viewerTelegramId) {
  if (!charge?.receiptUrl) return charge;
  const relative = String(charge.receiptUrl).replace(/^\/uploads\//, "").split("?")[0];
  return {
    ...charge,
    receiptUrl: signUploadAccess(relative, viewerTelegramId, 600),
  };
}
