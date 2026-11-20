"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { ApiError } from "@/lib/api/client";
import { meApi } from "@/lib/api/staff";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo, BrandMark } from "./brand-mark";

/**
 * Three things have to be true to see the console: Clerk has a session,
 * the API knows the person (a Medora account, linked on first sign-in by
 * verified email), and they have an active membership in some tenant.
 *
 * They fail differently. No session is a sign-in problem and redirects.
 * The other two are not: the person has signed in, and sending them back
 * to sign-in would loop. They need an owner to invite them, or to make
 * their membership active again, so the screen says so and offers a way out.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

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

  if (!me.data.memberships.some((m) => m.status === "active")) {
    return (
      <Centered>
        <h1 className="gate-title">Your access is paused</h1>
        <p className="gate-text">
          You are signed in as <b>{email}</b>, but your access is paused in every tenant you belong to. Ask an owner to make
          it active again.
        </p>
        <div className="gate-actions">{signOutButton}</div>
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
