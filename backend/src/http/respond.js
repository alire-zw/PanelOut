export function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  };
  if (status === 429 && extraHeaders["retry-after"]) {
    headers["retry-after"] = String(extraHeaders["retry-after"]);
  }
  res.writeHead(status, headers);
  res.end(payload);
}

export function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

export function sendUnauthorized(res) {
  sendJson(res, 401, { ok: false, error: "Unauthorized" });
}

export function applyCors(req, res, { origins }) {
  const requestOrigin = req.headers.origin;
  const allowed =
    requestOrigin && origins.some((origin) => origin === requestOrigin);

  // Reflect only allowlisted origins — never *
  if (allowed) {
    res.setHeader("access-control-allow-origin", requestOrigin);
    res.setHeader("vary", "Origin");
    res.setHeader("access-control-allow-credentials", "true");
  }

  res.setHeader(
    "access-control-allow-methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "access-control-allow-headers",
    "Content-Type, Authorization, X-Telegram-Init-Data",
  );
  res.setHeader("access-control-max-age", "600");
}
