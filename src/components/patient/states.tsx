"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Loading, empty and failed are three different screens (ADR 0031): a read
 * that failed never looks like a patient with nothing recorded.
 */

/** Where a card's content will be. */
export function CardLoading({ label }: { label: string }) {
  return (
    <div className="pt-loading" role="status" aria-label={label}>
      <Skeleton className="pt-skel-line" />
      <Skeleton className="pt-skel-block" />
    </div>
  );
}

/** A read that failed, with Try again. */
export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="pt-empty">
      <CircleAlert aria-hidden />
      <p className="pt-empty-title">We couldn&apos;t load {what}</p>
      <p>This is a problem at our end, and nothing you recorded is lost.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
