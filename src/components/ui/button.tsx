import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"

/**
 * The Grid UI kit's buttons (grid-kit.css: .btn, .btn-sm, .btn-icon).
 *
 * 36 tall with 10px corners and 14px sides; small is 30 with 8px corners;
 * icon buttons are 34 square. Primary carries the screen's one main action,
 * outline the rest, ghost for quiet actions in rows and menus. Destructive is
 * the kit's solid red and always names its verb ("Delete lead").
 */
export type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"
export type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg"

const TEXT_VARIANT: Record<ButtonVariant, string> = {
  default: "btn-primary",
  outline: "btn-outline",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  destructive: "btn-destructive",
  link: "btn-link",
}

const TEXT_SIZE: Record<string, string> = {
  default: "",
  lg: "",
  sm: "btn-sm",
  xs: "btn-xs",
}

const ICON_VARIANT: Record<ButtonVariant, string> = {
  default: "is-primary",
  outline: "",
  secondary: "bare is-secondary",
  ghost: "bare",
  destructive: "is-danger",
  link: "bare",
}

const ICON_SIZE: Record<string, string> = {
  icon: "",
  "icon-lg": "is-lg",
  "icon-sm": "is-sm",
  "icon-xs": "is-xs",
}

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: { variant?: ButtonVariant | null; size?: ButtonSize | null; className?: string } = {}) {
  const v = variant ?? "default"
  const s = size ?? "default"
  if (s.startsWith("icon")) {
    return cn("btn-icon", ICON_VARIANT[v], ICON_SIZE[s], className)
  }
  return cn("btn", TEXT_VARIANT[v], TEXT_SIZE[s], className)
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & { variant?: ButtonVariant | null; size?: ButtonSize | null }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={
        typeof className === "function"
          ? (state) => buttonVariants({ variant, size, className: className(state) })
          : buttonVariants({ variant, size, className })
      }
      {...props}
    />
  )
}

export { Button }
