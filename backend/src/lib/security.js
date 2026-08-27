import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }
  return (req.socket?.remoteAddress || "unknown").slice(0, 64);
}

export function applySecurityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("cross-origin-resource-policy", "same-site");
  res.setHeader("cross-origin-opener-policy", "same-origin");
  res.setHeader("cache-control", "no-store");
}

/** Safe join under a root dir — blocks traversal and sibling-prefix tricks. */
export function resolveUnderRoot(rootDir, relativePath) {
  const root = path.resolve(rootDir);
  const absolute = path.resolve(root, relativePath);
  const rel = path.relative(root, absolute);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return absolute;
}

export function safeEqualString(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) {
    // still do a compare to reduce timing leak on length
    timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
    return false;
  }
  return timingSafeEqual(left, right);
}

export function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

/** Detect image type from magic bytes (do not trust client MIME alone). */
export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Origin / Referer must match Mini App allowlist when present.
 * Telegram WebView usually sends the Mini App origin.
 */
export function assertTrustedMiniAppOrigin(req, allowedOrigins) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const referer = typeof req.headers.referer === "string" ? req.headers.referer.trim() : "";

  if (origin) {
    if (!allowedOrigins.includes(origin)) {
      throw Object.assign(new Error("Unauthorized"), { status: 401, code: "BAD_ORIGIN" });
    }
    return;
  }

  if (referer) {
    const ok = allowedOrigins.some(
      (allowed) => referer === allowed || referer.startsWith(`${allowed}/`),
    );
    if (!ok) {
      throw Object.assign(new Error("Unauthorized"), { status: 401, code: "BAD_REFERER" });
    }
  }
}
