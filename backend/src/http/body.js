/**
 * Read and parse JSON request body.
 */
export async function readJsonBody(req, { limitBytes = 64_000 } = {}) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      throw Object.assign(new Error("Request body too large"), { status: 413 });
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
}
