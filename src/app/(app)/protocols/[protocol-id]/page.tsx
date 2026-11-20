import type { Metadata } from "next";
import { ProtocolPage } from "./protocol-page";

export const metadata: Metadata = { title: "Protocol" };

export default async function Page({ params }: { params: Promise<{ "protocol-id": string }> }) {
  const { "protocol-id": protocolId } = await params;
  return <ProtocolPage protocolId={protocolId} />;
}
