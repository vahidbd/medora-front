import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/*
 * The visitor's address, passed to the API so its rate limits key on the
 * person rather than on this web server (the API's src/lib/client-ip.ts,
 * ADR 0030).
 *
 * The host's edge writes the address it saw into x-real-ip and replaces
 * any a visitor sends. We pass it on as x-medora-client-ip, signed with
 * FORWARDED_IP_SECRET (the API holds the same secret):
 * "<unix seconds>.<HMAC-SHA256 of '<seconds>.<address>'>", base64url. The
 * API believes it for five minutes. Without the secret nothing is sent and
 * the API keys on the connection, which is this server.
 */

export const CLIENT_IP_HEADER = "x-medora-client-ip";
export const CLIENT_IP_SIGNATURE_HEADER = "x-medora-client-ip-signature";

/** The address the host's edge saw. Never the first X-Forwarded-For entry, which a visitor can write. */
function visitorAddress(source: Headers): string | null {
  const real = source.get("x-real-ip")?.trim();
  return real && isIP(real) ? real : null;
}

/** The signature the API checks. */
export function signClientIp(address: string, secret: string, now = Date.now()): string {
  const seconds = String(Math.floor(now / 1000));
  return `${seconds}.${createHmac("sha256", secret).update(`${seconds}.${address}`).digest("base64url")}`;
}

/** Headers carrying the visitor's address to the API, from the request this server is answering. */
export function clientIpHeaders(source: Headers, now = Date.now()): Record<string, string> {
  const address = visitorAddress(source);
  const secret = process.env.FORWARDED_IP_SECRET?.trim();
  if (!address || !secret || secret.length < 32) return {};
  return { [CLIENT_IP_HEADER]: address, [CLIENT_IP_SIGNATURE_HEADER]: signClientIp(address, secret, now) };
}
