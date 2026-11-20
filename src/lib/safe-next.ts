const BASE = "https://medora.invalid";

/**
 * Where to go after signing in: a path on this app, or Home. Read the way a
 * browser reads it, so "//elsewhere", "/\elsewhere" and a tab or newline
 * hidden in the path can't send a person to another site (CON1).
 */
export function safeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/")) return "/home";
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return "/home";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/home";
  }
}
