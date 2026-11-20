import { StaffClerk } from "@/components/shell/staff-clerk";

/** Sign-in is Clerk's (page.tsx), mounted here rather than at the root. */
export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <StaffClerk>{children}</StaffClerk>;
}
