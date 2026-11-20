import type { Metadata } from "next";
import { ProtocolsPage } from "./protocols-page";

export const metadata: Metadata = { title: "Protocols" };

export default function Page() {
  return <ProtocolsPage />;
}
