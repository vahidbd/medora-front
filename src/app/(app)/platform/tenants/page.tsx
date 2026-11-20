import type { Metadata } from "next";
import { PlatformOnly } from "../platform-only";
import { PlatformTenantsPage } from "./tenants-page";

export const metadata: Metadata = { title: "Tenants" };

export default function Page() {
  return (
    <PlatformOnly>
      <PlatformTenantsPage />
    </PlatformOnly>
  );
}
