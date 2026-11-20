/** The mock API's replies, in the API's own envelope: `{ error: { code, message, details } }` on failure. */

export function send(res, status, body, headers = {}) {
  const text = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(text);
}

export function fail(res, status, code, message, details) {
  send(res, status, { error: { code, message, ...(details === undefined ? {} : { details }) } });
}

export const BAD_REQUEST = "Some of what was sent is missing or not in the right form";

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return Symbol.for("bad-json");
  }
}

export const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
