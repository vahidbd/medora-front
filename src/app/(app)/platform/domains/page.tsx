import type { Metadata } from "next";
import { PlatformOnly } from "../platform-only";
import { PlatformDomainsPage } from "./domains-page";

export const metadata: Metadata = { title: "Domains to verify" };

export default function Page() {
  return (
    <PlatformOnly>
      <PlatformDomainsPage />
    </PlatformOnly>
  );
}
