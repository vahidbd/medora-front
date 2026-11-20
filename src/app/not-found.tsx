import Link from "next/link";
import { BrandLogo } from "@/components/shell/brand-mark";

/** A pasted link or an old bookmark that leads nowhere. */
export default function NotFound() {
  return (
    <main className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <BrandLogo />
        </div>
        <h1 className="gate-title">Page not found</h1>
        <p className="gate-text">Nothing in Medora lives at this address. The link may be cut short, or what it named was removed.</p>
        <div className="gate-actions">
          <Link href="/home" className="btn btn-primary">
            Go to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
