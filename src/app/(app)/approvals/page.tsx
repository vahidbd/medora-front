import type { Metadata } from "next";
import { ApprovalsPage } from "./approvals-page";

export const metadata: Metadata = { title: "Approvals" };

export default function Page() {
  return <ApprovalsPage />;
}
