import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The kit's notice: an 18px icon column, a 500-weight title and a line of
 * body on a soft wash with a matching border. Tones: info (the kit's blue
 * callout), success, warning, danger, neutral.
 */
type AlertVariant = "default" | "destructive" | "info" | "success" | "warning" | "danger" | "neutral"

const TONE: Record<AlertVariant, string> = {
  default: "neutral",
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  destructive: "danger",
  danger: "danger",
}

function alertVariants({ variant = "default" }: { variant?: AlertVariant | null } = {}) {
  return cn("alert notice", TONE[variant ?? "default"])
}

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant | null }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("notice-title", className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("notice-text", className)}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("notice-action", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants }
