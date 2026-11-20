"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChoiceSelect, optionsOf } from "@/components/shared/choice-select";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { useTenant } from "@/components/shell/tenant-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { messageOf } from "@/lib/api/errors";
import { consentDocumentsApi } from "@/lib/api/patients";
import type { ConsentDocument, ConsentKind } from "@/lib/api/types";
import { CONSENT_KIND_LABELS } from "@/lib/patients";

/** Kinds every patient needs before care: a new version asks them again (IDN13). */
const ASKED_AGAIN: ReadonlySet<ConsentKind> = new Set(["privacy", "telehealth_terms"]);

/** Publish a new version of one consent document. Published text never changes (IDN14). */
export function PublishSheet({ open, onOpenChange, documents }: { open: boolean; onOpenChange: (open: boolean) => void; documents: ConsentDocument[] }) {
  return open ? <PublishForm onOpenChange={onOpenChange} documents={documents} /> : null;
}

function PublishForm({ onOpenChange, documents }: { onOpenChange: (open: boolean) => void; documents: ConsentDocument[] }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ConsentKind | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const latest = kind ? documents.filter((d) => d.kind === kind).sort((a, b) => b.version - a.version)[0] : undefined;

  const publish = useMutation({
    mutationFn: () => consentDocumentsApi.publish(current.tenantId, { kind: kind!, title: title.trim(), body: body.trim() }),
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: ["consent-documents", current.tenantId] });
      toast.success("Version published", { description: `${CONSENT_KIND_LABELS[doc.kind]}, version ${doc.version}` });
      onOpenChange(false);
    },
    onError: (err) => setError(messageOf(err, "The version was not published. Try again.")),
  });

  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title="Publish a version"
      description="Published text never changes. To change it later, publish another version."
      note={kind && ASKED_AGAIN.has(kind) ? "Patients are asked to agree again before their next care." : undefined}
      saving={publish.isPending}
      ready={kind !== null && title.trim() !== "" && body.trim() !== ""}
      error={error}
      onSave={() => {
        setError(null);
        publish.mutate();
      }}
      saveLabel="Publish"
    >
      <div className="field">
        <label htmlFor="consent-kind">
          Document <span className="req">*</span>
        </label>
        <ChoiceSelect
          id="consent-kind"
          value={kind}
          options={optionsOf(CONSENT_KIND_LABELS)}
          onChange={(next) => {
            setKind(next);
            const previous = documents.filter((d) => d.kind === next).sort((a, b) => b.version - a.version)[0];
            if (previous) {
              setTitle(previous.title);
              setBody(previous.body);
            }
          }}
        />
        <div className="helper">{latest ? `This will be version ${latest.version + 1}.` : "This will be version 1."}</div>
      </div>
      <div className="field">
        <label htmlFor="consent-title">
          Title <span className="req">*</span>
        </label>
        <Input id="consent-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="consent-body">
          Text <span className="req">*</span>
        </label>
        <Textarea id="consent-body" rows={14} maxLength={50000} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="helper">Patients read exactly this. Leave a blank line between paragraphs.</div>
      </div>
    </EditDrawer>
  );
}
