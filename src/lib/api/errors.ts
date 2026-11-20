import { ApiError } from "./client";

/**
 * What to tell a person when a call is refused. The API's messages are
 * written for people and never carry a code or a path, so they are shown
 * as they are; anything else gets the fallback.
 */
export function messageOf(error: unknown, fallback = "Medora could not do that. Nothing has changed."): string {
  if (error instanceof ApiError && error.status < 500 && error.message) return error.message;
  return fallback;
}
