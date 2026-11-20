"use client";

import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useUser } from "@clerk/nextjs";
import { formatCalendarDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBrand } from "@/components/patient/brand-context";
import { usePatientSignOut } from "@/components/patient/sign-out";
import { useSignedInPatient } from "@/components/patient/use-patient";

/**
 * Account: who the patient is to this brand, how the app looks, their
 * privacy rights and signing out. A copy of the record and deleting the
 * account go through support until they have their own screens (APP8).
 */
export function PatientAccountPage() {
  const me = useSignedInPatient();
  const { user } = useUser();
  const brand = useBrand();
  const signOut = usePatientSignOut();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  return (
    <div className="pt-page">
      <div className="pt-head">
        <h1 className="pt-title">Your account</h1>
        <p className="pt-lede">Your details with {brand.name}, and how this app works for you.</p>
      </div>

      <section className="pt-card" aria-labelledby="details-title">
        <h2 className="pt-card-title" id="details-title">
          Your details
        </h2>
        <ul className="pt-facts">
          <Fact label="Name" value={me.displayName} />
          <Fact label="Date of birth" value={formatCalendarDate(me.dateOfBirth)} />
          <Fact label="Email" value={me.email ?? email ?? "Not set"} />
          <Fact label="Mobile" value={me.mobile ?? "Not set"} />
        </ul>
        <p className="pt-muted">To change your details, contact {brand.name} so your care team has them right.</p>
      </section>

      <Appearance />

      <section className="pt-card" aria-labelledby="privacy-title">
        <div>
          <h2 className="pt-card-title" id="privacy-title">
            Your privacy
          </h2>
          <p className="pt-card-sub">
            You can ask for a copy of your health record, or ask {brand.name} to close your account and delete what the law allows.
          </p>
        </div>
        <p className="pt-text">
          {brand.supportEmail ? (
            <>
              Email <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
              {brand.supportPhone ? ` or call ${brand.supportPhone}` : ""} and say which you&apos;d like. Health records are kept for as long as the law
              requires, even after an account closes.
            </>
          ) : (
            `Contact ${brand.name} and say which you'd like. Health records are kept for as long as the law requires, even after an account closes.`
          )}
        </p>
      </section>

      <div>
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </Button>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="pt-fact">
      <span className="pt-fact-text">
        <span className="pt-muted">{label}</span>
        <strong>{value}</strong>
      </span>
    </li>
  );
}

const THEMES = [
  { value: "system", label: "Match my device", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

function Appearance() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="pt-card" aria-labelledby="appearance-title">
      <h2 className="pt-card-title" id="appearance-title">
        Appearance
      </h2>
      <RadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(String(value))} aria-labelledby="appearance-title" className="pt-choices">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <label key={value} className="pt-choice">
            <RadioGroupItem value={value} />
            <Icon aria-hidden />
            <span>{label}</span>
          </label>
        ))}
      </RadioGroup>
    </section>
  );
}
