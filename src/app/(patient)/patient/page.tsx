import { redirect } from "next/navigation";

/** A brand's patient app opens on Home. */
export default function PatientRoot() {
  redirect("/home");
}
