import { StaffClerk } from "@/components/shell/staff-clerk";

/** Accepting an invitation is Clerk's (page.tsx), mounted here rather than at the root. */
export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <StaffClerk>{children}</StaffClerk>;
}
