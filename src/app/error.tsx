"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A page outside the staff shell that couldn't load, such as sign-in. It
 * names no tenant and no screen, since either may be what failed.
 */
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md rounded-lg border border-dashed border-border-strong">
        <div className="list-empty" role="alert">
          <div className="empty-icon">
            <TriangleAlert />
          </div>
          <h1 className="empty-title">This page is unavailable at the moment</h1>
          <p className="empty-text">Nothing was changed. Try again in a moment.</p>
          <div className="empty-actions">
            <Button onClick={() => retry()}>Try again</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
