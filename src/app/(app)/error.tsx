"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SENTRY_DSN } from "@/lib/error-tracking/scrub";

/** A screen that failed while showing, inside the shell, with a way to try again. */
export default function ScreenError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Error tracking, when it is on (staff screens only; see lib/error-tracking/browser.ts).
    // Nothing goes to the console: in development Next's overlay already shows the error.
    if (SENTRY_DSN) {
      import("@/lib/error-tracking/browser")
        .then((tracking) =>
          tracking.reportBrowserError(error, { boundary: "screen", ...(error.digest ? { digest: error.digest } : {}) }),
        )
        .catch(() => {});
    }
  }, [error]);

  return (
    <div>
      <PageHeader title="This page couldn't load" description="Something went wrong while showing it." />
      <div className="rounded-lg border border-dashed border-border-strong">
        <div className="list-empty" role="alert">
          <div className="empty-icon">
            <TriangleAlert />
          </div>
          <div className="empty-title">Nothing was changed</div>
          <p className="empty-text">
            Try again in a moment. If it keeps happening, go back to Home and open the record from there.
          </p>
          <div className="empty-actions">
            <Link href="/" className="btn btn-outline">
              Go to Home
            </Link>
            <Button onClick={() => retry()}>Try again</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
