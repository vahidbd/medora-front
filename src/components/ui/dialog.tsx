"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

/**
 * The Grid UI kit's dialog (grid-kit.css: .dlg). 480 wide by default with
 * 18px corners: an optional 38px icon tile, a 16/600 title with one line
 * under it, a 30px close, the body, then a foot on the subtle ground with a
 * note on the left and the actions on the right. The page dims and blurs.
 *
 * Markup stays shadcn-shaped (DialogHeader, DialogTitle, DialogDescription,
 * DialogFooter) so every existing dialog picks the kit up as it is.
 */

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn("dlg-backdrop", className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "dlg dlg-popup w-full max-w-[calc(100%-2rem)] sm:max-w-[var(--dialog-w)]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="dlg-close dlg-close-abs"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("dlg-header", className)}
      {...props}
    />
  )
}

/** The kit's 38px icon tile, placed first inside DialogHeader. */
function DialogIcon({
  className,
  tone,
  ...props
}: React.ComponentProps<"div"> & { tone?: "danger" | "ai" }) {
  return (
    <div
      data-slot="dialog-icon"
      className={cn("dlg-icon", tone, className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  note,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  /** Short note on the left of the foot, e.g. "You can change this later." */
  note?: React.ReactNode
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("dlg-foot dlg-footer", className)}
      {...props}
    >
      {note ? <div className="dlg-note">{note}</div> : null}
      <div className="dlg-actions">
        {showCloseButton && (
          <DialogPrimitive.Close className="btn btn-outline">Close</DialogPrimitive.Close>
        )}
        {children}
      </div>
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("dlg-title", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("dlg-sub", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogIcon,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
