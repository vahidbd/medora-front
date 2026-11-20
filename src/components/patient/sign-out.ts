"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/nextjs";

/*
 * Signing a patient out, by choice or after 30 minutes without activity on
 * a shared device (APP5). Everything loaded is dropped from memory first,
 * so nothing the patient saw survives the session. The patient Clerk
 * instance ends idle sessions on its own too; this timer is the screen's
 * courtesy, not the rule.
 */

export const IDLE_MINUTES = 30;

export function usePatientSignOut() {
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  return useCallback(
    async (why?: "idle") => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut({ redirectUrl: why ? `/sign-in?why=${why}` : "/sign-in" });
    },
    [queryClient, signOut],
  );
}

const ACTIVITY = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/** Signs out after IDLE_MINUTES with no pointer, key, scroll or touch in this tab. */
export function useIdleSignOut(minutes = IDLE_MINUTES) {
  const signOut = usePatientSignOut();
  const last = useRef(0);

  useEffect(() => {
    last.current = Date.now();
    const limit = minutes * 60_000;
    const touch = () => {
      last.current = Date.now();
    };
    const check = () => {
      if (Date.now() - last.current >= limit) void signOut("idle");
    };
    for (const name of ACTIVITY) window.addEventListener(name, touch, { passive: true });
    // A tab coming back from sleep checks at once, rather than waiting for the next tick.
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 30_000);
    return () => {
      for (const name of ACTIVITY) window.removeEventListener(name, touch);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [minutes, signOut]);
}
