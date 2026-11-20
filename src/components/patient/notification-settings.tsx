"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientApi, patientKey } from "@/lib/api/patient";
import type { NotificationPreferences } from "@/lib/api/types";
import { Switch } from "@/components/ui/switch";
import { useBrand } from "./brand-context";
import { CardLoading, LoadFailed } from "./states";

/**
 * How the patient hears from their care (docs/decisions/notifications.md in
 * medora-backend): email always, texts and reminders theirs to turn off.
 * Each switch saves as it changes.
 */
export function NotificationSettings({ mobile }: { mobile: string | null }) {
  const id = useId();
  const { host } = useBrand();
  const queryClient = useQueryClient();
  const key = patientKey(host, "notification-preferences");
  const preferences = useQuery({ queryKey: key, queryFn: patientApi.notificationPreferences });
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: patientApi.setNotificationPreferences,
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      setNote({ ok: true, text: "Saved." });
    },
    onError: () => setNote({ ok: false, text: "We couldn't save that just now. Try again." }),
  });

  function change(next: Partial<NotificationPreferences>) {
    if (!preferences.data) return;
    setNote(null);
    save.mutate({ ...preferences.data, ...next });
  }

  return (
    <section className="pt-card" aria-labelledby={`${id}-title`}>
      <div>
        <h2 className="pt-card-title" id={`${id}-title`}>
          How we contact you
        </h2>
        <p className="pt-card-sub">We always email you about your care. Messages from your care team reach you whatever you choose here.</p>
      </div>
      {preferences.isPending ? (
        <CardLoading label="Loading how we contact you" />
      ) : preferences.isError ? (
        <LoadFailed what="how we contact you" onRetry={() => void preferences.refetch()} />
      ) : (
        <ul className="pt-facts">
          <li className="pt-fact">
            <span className="pt-fact-text">
              <strong id={`${id}-sms`}>Texts</strong>
              <span className="pt-muted" id={`${id}-sms-detail`}>
                {mobile ? `Texts to ${mobile} as well as emails.` : "Texts need a mobile number on your account. Contact us to add one."}
              </span>
            </span>
            <Switch
              checked={preferences.data.sms}
              onCheckedChange={(sms) => change({ sms })}
              disabled={save.isPending}
              aria-labelledby={`${id}-sms`}
              aria-describedby={`${id}-sms-detail`}
            />
          </li>
          <li className="pt-fact">
            <span className="pt-fact-text">
              <strong id={`${id}-reminders`}>Reminders</strong>
              <span className="pt-muted" id={`${id}-reminders-detail`}>
                When a check-in is due, or it&apos;s time to record a reading.
              </span>
            </span>
            <Switch
              checked={preferences.data.reminders}
              onCheckedChange={(reminders) => change({ reminders })}
              disabled={save.isPending}
              aria-labelledby={`${id}-reminders`}
              aria-describedby={`${id}-reminders-detail`}
            />
          </li>
        </ul>
      )}
      {note ? (
        <p className={note.ok ? "pt-success" : "pt-error"} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      ) : null}
    </section>
  );
}
