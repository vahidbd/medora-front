"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { EditDrawer } from "@/components/shared/record/edit-drawer";
import { useTenant } from "@/components/shell/tenant-context";
import { Input } from "@/components/ui/input";
import { messageOf } from "@/lib/api/errors";
import { protocolsApi } from "@/lib/api/protocols";

/** Start a protocol as a draft from one of the platform's templates (INT10). The tenant's medical director still signs off their copy. */
export function NewProtocolSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return open ? <NewProtocolForm onOpenChange={onOpenChange} /> : null;
}

function NewProtocolForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { current } = useTenant();
  const queryClient = useQueryClient();
  const router = useRouter();
  const templates = useQuery({ queryKey: ["protocol-templates", current.tenantId], queryFn: () => protocolsApi.templates(current.tenantId) });
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const template = templates.data?.find((t) => t.key === templateKey);

  const create = useMutation({
    mutationFn: () => protocolsApi.create(current.tenantId, { name: name.trim(), templateKey: templateKey!, ...(condition.trim() ? { condition: condition.trim() } : {}) }),
    onSuccess: (protocol) => {
      void queryClient.invalidateQueries({ queryKey: ["protocols", current.tenantId] });
      toast.success("Protocol started as a draft", { description: protocol.name });
      onOpenChange(false);
      router.push(`/protocols/${protocol.protocolId}`);
    },
    onError: (err) => setError(messageOf(err, "The protocol was not started. Try again.")),
  });

  return (
    <EditDrawer
      open
      onOpenChange={onOpenChange}
      title="New protocol"
      description="It starts as a draft copy of the template. Nothing reaches patients until your medical director signs it off."
      saving={create.isPending}
      ready={templateKey !== null && name.trim() !== ""}
      error={templates.isError ? "The templates did not load. Close this and try again." : error}
      onSave={() => {
        setError(null);
        create.mutate();
      }}
      saveLabel="Start draft"
    >
      <div className="field">
        <label htmlFor="protocol-template">
          Template <span className="req">*</span>
        </label>
        <ChoiceSelect
          id="protocol-template"
          value={templateKey}
          placeholder={templates.isPending ? "Loading templates" : "Choose"}
          options={(templates.data ?? []).map((t) => ({ value: t.key, label: t.name }))}
          onChange={(key) => {
            setTemplateKey(key);
            const chosen = templates.data?.find((t) => t.key === key);
            if (chosen && !name) setName(chosen.name);
          }}
        />
        {template ? (
          <div className="helper">
            {template.summary}{" "}
            {template.clinicalReview
              ? `Reviewed for Medora by ${template.clinicalReview.by} on ${template.clinicalReview.on}.`
              : "Not yet reviewed by a medical practitioner for Medora."}
          </div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="protocol-name">
          Name <span className="req">*</span>
        </label>
        <Input id="protocol-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="helper">Staff see this name. Patients see the program&apos;s name.</div>
      </div>
      <div className="field">
        <label htmlFor="protocol-condition">Condition</label>
        <Input id="protocol-condition" maxLength={120} placeholder={template?.condition} value={condition} onChange={(e) => setCondition(e.target.value)} />
        <div className="helper">Leave empty to use the template&apos;s.</div>
      </div>
    </EditDrawer>
  );
}
