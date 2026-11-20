"use client";

import * as React from "react";
import { FileText, Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * File pickers in the kit's look, so the browser's "Choose file / No file
 * chosen" control never shows: the native input stays hidden and only opens
 * the system dialog.
 */

/** "PDF", "DOCX", "Images" for the accepted-types line. */
function typeName(token: string): string {
  const t = token.trim().toLowerCase();
  if (t.startsWith(".")) return t.slice(1).toUpperCase();
  if (t.endsWith("/*")) {
    const kind = t.slice(0, -2);
    return { image: "Images", audio: "Audio", video: "Video", text: "Text files" }[kind] ?? `${kind} files`;
  }
  const known: Record<string, string> = {
    "application/pdf": "PDF",
    "text/csv": "CSV",
    "text/plain": "TXT",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/zip": "ZIP",
    "application/json": "JSON",
    "image/png": "PNG",
    "image/jpeg": "JPG",
  };
  return known[t] ?? (t.split("/").pop() ?? t).toUpperCase();
}

function list(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

/** "10 MB" for a limit (whole numbers lose the ".0"). */
function sizeLimit(bytes: number): string {
  return formatFileSize(bytes).replace(/\.0 /, " ");
}

/** The accepted types and size limit, as one line: "PDF or DOCX, up to 10 MB". */
export function describeAccept(accept?: string, maxSize?: number): string {
  const names = accept
    ? Array.from(new Set(accept.split(",").filter((t) => t.trim()).map(typeName)))
    : [];
  const types = names.length ? list(names) : "Any file";
  return maxSize ? `${types}, up to ${sizeLimit(maxSize)}` : types;
}

/** Whether a file matches an `accept` string (drops skip the dialog's own filter). */
export function acceptsFile(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return accept.split(",").some((raw) => {
    const t = raw.trim().toLowerCase();
    if (!t) return false;
    if (t.startsWith(".")) return name.endsWith(t);
    if (t.endsWith("/*")) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

export type FileDropProps = {
  /** Types the picker offers and the drop accepts, as for `<input accept>` (".pdf,.docx", "image/*"). */
  accept?: string;
  /** Allow more than one file; new picks are added to the list. */
  multiple?: boolean;
  /** Largest file allowed, in bytes. */
  maxSize?: number;
  /** The chosen files (controlled). */
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  /** Replaces the accepted-types line ("CSV exported from the bank, up to 5 MB"). */
  hint?: React.ReactNode;
  /** The drop zone's id, for a `<label htmlFor>`. */
  id?: string;
  /** Names the drop zone for screen readers when no label points at it. */
  "aria-label"?: string;
  "aria-describedby"?: string;
  /** Danger border, for a form that found no file. */
  "aria-invalid"?: boolean;
  className?: string;
};

/**
 * The kit's dropzone, wherever a file is the point (document upload, import,
 * attachments): "Drop a file or browse" over the accepted types and size
 * limit, highlighted while a file is dragged over it, a button for the
 * keyboard. Chosen files list under it as kit rows (name, size, remove).
 * With `multiple` off, the zone gives way to the one chosen file until it is
 * removed. A file of the wrong type or over the limit is turned away with a
 * line saying why.
 */
export function FileDrop({
  accept,
  multiple = false,
  maxSize,
  files,
  onFilesChange,
  disabled = false,
  hint,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
}: FileDropProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hintId = React.useId();
  const errorId = React.useId();
  const [dragging, setDragging] = React.useState(false);
  const [rejected, setRejected] = React.useState<string | null>(null);

  const take = (picked: File[]) => {
    if (disabled || picked.length === 0) return;
    const ok: File[] = [];
    const turnedAway: string[] = [];
    for (const file of multiple ? picked : picked.slice(0, 1)) {
      if (!acceptsFile(file, accept)) turnedAway.push(`${file.name} can't be added. Use ${describeAccept(accept)}.`);
      else if (maxSize && file.size > maxSize) turnedAway.push(`${file.name} is over the ${sizeLimit(maxSize)} limit.`);
      else ok.push(file);
    }
    setRejected(turnedAway.length ? turnedAway.join(" ") : null);
    if (ok.length === 0) return;
    if (multiple) onFilesChange([...files, ...ok.filter((f) => !files.some((g) => sameFile(f, g)))]);
    else onFilesChange(ok.slice(0, 1));
  };

  const remove = (index: number) => {
    setRejected(null);
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const showZone = multiple || files.length === 0;
  const describedBy = [ariaDescribedBy, hintId, rejected ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("file-drop", className)} data-disabled={disabled || undefined}>
      {showZone ? (
        <button
          type="button"
          id={id}
          className="file-drop-zone"
          data-dragging={dragging || undefined}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          data-invalid={ariaInvalid || undefined}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            if (disabled || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            if (disabled || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!dragging) setDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(Array.from(e.dataTransfer.files));
          }}
        >
          <span className="file-drop-icon" aria-hidden>
            <Upload />
          </span>
          <span className="file-drop-title">
            {multiple ? "Drop files or " : "Drop a file or "}
            <span className="file-drop-browse">browse</span>
          </span>
          <span className="file-drop-hint" id={hintId}>
            {hint ?? describeAccept(accept, maxSize)}
          </span>
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          take(Array.from(e.target.files ?? []));
          // Let the same file be picked again after it is removed.
          e.target.value = "";
        }}
      />

      {files.length > 0 ? (
        <ul className="row-list file-list" aria-label={multiple ? "Chosen files" : "Chosen file"}>
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="row-list-item file-row">
              <span className="file-row-icon" aria-hidden>
                <FileText />
              </span>
              <span className="rl-main">
                <span className="rl-title" title={file.name}>
                  {file.name}
                </span>
                <span className="rl-sub">{formatFileSize(file.size)}</span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {rejected ? (
        <p className="err file-drop-error" id={errorId} role="alert">
          {rejected}
        </p>
      ) : null}
    </div>
  );
}

export type FileButtonProps = {
  accept?: string;
  multiple?: boolean;
  /** Called with the picked files (none when the dialog is cancelled). */
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** The button's words, and its accessible name when `iconOnly`. Default "Attach file". */
  label?: string;
  /** Replaces the label inside the button (the paperclip stays). */
  children?: React.ReactNode;
  /** Just the paperclip, for a composer's toolbar. */
  iconOnly?: boolean;
  className?: string;
};

/**
 * A compact outline kit button that opens the system file dialog, for tight
 * spots such as a composer. Elsewhere use FileDrop.
 */
export function FileButton({
  accept,
  multiple = false,
  onFiles,
  disabled = false,
  label = "Attach file",
  children,
  iconOnly = false,
  className,
}: FileButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon-sm" : "sm"}
        className={className}
        disabled={disabled}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip />
        {iconOnly ? null : (children ?? label)}
      </Button>
      <input
        ref={inputRef}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length) onFiles(picked);
        }}
      />
    </>
  );
}
