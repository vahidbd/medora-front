"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { ApiError } from "@/lib/api/client";
import { meApi } from "@/lib/api/staff";
import { formatDate } from "@/lib/format";
import { isUsable } from "@/lib/staff-access";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo, BrandMark } from "./brand-mark";

/**
 * Four things have to be true to see the console: Clerk has a session,
 * the API knows the person (a Medora account, linked on first sign-in by
 * verified email), they have a usable membership in some tenant (active and
 * not past its end date), and this session used a second factor.
 *
 * They fail differently. No session is a sign-in problem and redirects.
 * The others are not: the person has signed in, and sending them back to
 * sign-in would loop. They need an invitation, a fresh one, their
 * membership made active again, or two-step sign-in set up, so the screen
 * says which and offers a way out. The API refuses every tenant call
 * without a second factor whatever this screen shows (ADR 0036).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: meApi.get,
    retry: false,
    enabled: isLoaded && isSignedIn === true,
  });

  // An expired session (401 without an account problem) goes back to sign-in too.
  const sessionGone = me.error instanceof ApiError && me.error.status === 401 && me.error.code !== "no_account";
  useEffect(() => {
    if ((isLoaded && !isSignedIn) || sessionGone) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [isLoaded, isSignedIn, sessionGone, pathname, router]);

  if (!isLoaded || !isSignedIn || me.isPending || sessionGone) return <ShellSkeleton />;

  const email = user?.primaryEmailAddress?.emailAddress ?? "this account";
  const signOutButton = (
    <Button variant="outline" onClick={() => void signOut({ redirectUrl: "/sign-in" })}>
      Sign out
    </Button>
  );

  if (me.error) {
    const noAccount = me.error instanceof ApiError && me.error.code === "no_account";
    return (
      <Centered>
        <h1 className="gate-title">{noAccount ? "No Medora account" : "Medora is unavailable"}</h1>
        <p className="gate-text">
          {noAccount ? (
            <>
              You are signed in as <b>{email}</b>, but nobody has invited that address to Medora yet. Ask an owner to invite
              you, then sign in again.
            </>
          ) : (
            "We could not reach Medora. Your sign-in worked, so this is a problem at our end."
          )}
        </p>
        <div className="gate-actions">
          {noAccount ? null : <Button onClick={() => void me.refetch()}>Try again</Button>}
          {signOutButton}
        </div>
      </Centered>
    );
  }

  const memberships = me.data.memberships;
  if (!memberships.some((m) => isUsable(m))) {
    // An invitation still open when this session began was accepted by the API, so one still invited has expired.
    const expiredInvitation = memberships.length > 0 && memberships.every((m) => m.status === "invited");
    const ended = memberships.filter((m) => m.status === "active" && m.expiresAt);
    const lastEnd = ended.length === memberships.length ? ended.map((m) => m.expiresAt!).sort().at(-1) : undefined;
    return (
      <Centered>
        <h1 className="gate-title">
          {expiredInvitation ? "Your invitation has expired" : lastEnd ? "Your access has ended" : "Your access is paused"}
        </h1>
        <p className="gate-text">
          You are signed in as <b>{email}</b>
          {expiredInvitation ? (
            <>. An invitation works for 14 days. Ask whoever invited you to send it again, then sign in.</>
          ) : lastEnd ? (
            <>, but your access ended on {formatDate(lastEnd)}. Ask an owner or tenant admin if you still need it.</>
          ) : (
            <>, but your access is paused in every tenant you belong to. Ask an owner to make it active again.</>
          )}
        </p>
        <div className="gate-actions">{signOutButton}</div>
      </Centered>
    );
  }

  if (!me.data.secondFactor) {
    return (
      <Centered>
        <h1 className="gate-title">Set up two-step sign-in</h1>
        <p className="gate-text">
          Every Medora staff account signs in with a second factor, such as a code from an authenticator app. Add one to{" "}
          <b>{email}</b>, then sign out and sign in again with it.
        </p>
        <div className="gate-actions">
          <Button onClick={() => openUserProfile()}>Set up two-step sign-in</Button>
          {signOutButton}
        </div>
      </Centered>
    );
  }

  return <>{children}</>;
}

/** While the session is checked: the shell's own frame, so nothing jumps when the console arrives. */
function ShellSkeleton() {
  return (
    <div className="app gate-shell" aria-busy="true" aria-label="Opening Medora">
      <aside className="sidebar" aria-hidden>
        <div className="sb-wide">
          <div className="sb-brand">
            <BrandMark />
            <Skeleton className="gate-skel-name" />
          </div>
          <Skeleton className="gate-skel-search" />
          <div className="sb-nav">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="sb-item">
                <Skeleton className="gate-skel-icon" />
                <Skeleton className="gate-skel-row" />
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <Skeleton className="gate-skel-crumb" />
        </div>
        <div className="page">
          <Skeleton className="gate-skel-title" />
          <Skeleton className="gate-skel-sub" />
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <BrandLogo />
        </div>
        {children}
      </div>
    </div>
  );
}
