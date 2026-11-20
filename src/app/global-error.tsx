"use client";

/**
 * When the root layout itself fails, nothing of it is left to draw with:
 * this page brings its own document and styles (the kit's light and dark
 * values, written out because the token file may be what failed). It names
 * no tenant, no screen and nothing about the failure.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-AU">
      <body style={{ margin: 0 }}>
        <title>Unavailable</title>
        <style>{`
          .ge { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #101828; background: #f7f7f8; }
          .ge-card { max-width: 440px; padding: 32px; border: 1px solid #e4e7ec; border-radius: 12px; background: #fff; text-align: center; }
          .ge h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
          .ge p { margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #475467; }
          .ge button { min-height: 40px; padding: 8px 20px; border: 0; border-radius: 8px; background: #101828; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
          @media (prefers-color-scheme: dark) {
            .ge { color: #f2f4f7; background: #111113; }
            .ge-card { border-color: #2e2e33; background: #18181b; }
            .ge p { color: #a1a1aa; }
            .ge button { background: #f2f4f7; color: #111113; }
          }
        `}</style>
        <main className="ge">
          <div className="ge-card" role="alert">
            <h1>This page is unavailable at the moment</h1>
            <p>Nothing was changed. Try again in a moment.</p>
            <button type="button" onClick={() => retry()}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
