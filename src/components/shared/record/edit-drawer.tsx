"use client";

import { useId, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Editing or adding to a record section. A section reads as facts; its
 * button opens this drawer with the fields, and Save sends one request.
 * Enter in a field saves too. The caller keeps the draft and closes the
 * drawer when the save succeeds; a refusal stays on screen in `error`.
 */
export function EditDrawer({
  open,
  onOpenChange,
  title,
  description,
  note,
  saving = false,
  ready = true,
  error,
  onSave,
  saveLabel = "Save changes",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The verb and the thing: "Add credential". */
  title: string;
  description?: string;
  note?: ReactNode;
  saving?: boolean;
  /** False while a required field is still empty: Save stays off. */
  ready?: boolean;
  /** Why the API said no, in its own words. */
  error?: string | null;
  onSave: () => void;
  saveLabel?: string;
  /** Kit fields (`.field`), paired with `.field-row` where two sit side by side. */
  children: ReactNode;
}) {
  const formId = useId();
  return (
    <Sheet open={open} onOpenChange={(next) => (!next && saving ? undefined : onOpenChange(next))}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <SheetBody>
          <form
            id={formId}
            className="field-stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!saving && ready) onSave();
            }}
          >
            {children}
            {error ? (
              <Alert variant="danger">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </form>
        </SheetBody>
        <SheetFooter note={note}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving || !ready}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
