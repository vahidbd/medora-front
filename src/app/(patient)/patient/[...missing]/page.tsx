import { notFound } from "next/navigation";

/** Any address on a patient host that isn't a screen gets the brand's own "not found", not the console's. */
export default function Missing() {
  notFound();
}
