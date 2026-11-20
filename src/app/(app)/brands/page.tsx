import type { Metadata } from "next";
import { BrandsPage } from "./brands-page";

export const metadata: Metadata = { title: "Brands" };

export default function Page() {
  return <BrandsPage />;
}
