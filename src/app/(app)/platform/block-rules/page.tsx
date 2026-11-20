import type { Metadata } from "next";
import { PlatformOnly } from "../platform-only";
import { BlockRulesPage } from "./block-rules-page";

export const metadata: Metadata = { title: "Block rules" };

export default function Page() {
  return (
    <PlatformOnly>
      <BlockRulesPage />
    </PlatformOnly>
  );
}
