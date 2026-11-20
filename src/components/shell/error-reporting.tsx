"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { meApi } from "@/lib/api/staff";
import { SENTRY_DSN } from "@/lib/error-tracking/scrub";

/**
 * Starts error tracking in the browser on a staff screen (mounted by
 * <StaffClerk>). The SDK is fetched on demand, from our own origin. Draws
 * nothing.
 */
export function ErrorReporting() {
  // AuthGate's query; this never fetches it.
  const { data } = useQuery({ queryKey: ["me"], queryFn: meApi.get, enabled: false });
  const userId = data?.userId ?? null;

  useEffect(() => {
    if (!SENTRY_DSN) return;
    import("@/lib/error-tracking/browser")
      .then((tracking) => tracking.setStaffUser(userId))
      .catch(() => {
        // Best effort: a chunk that fails to load must not break the screen.
      });
  }, [userId]);

  return null;
}
