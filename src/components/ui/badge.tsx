import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@/lib/utils"

/**
 * The kit's badge: a 24px pill with 12.5/500 text. Status goes through
 * StatusBadge (shared/status-badge.tsx), which adds the tone and the dot;
 * these variants are for plain labels.
 */
type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"

const VARIANT: Record<BadgeVariant, string> = {
  default: "badge-neutral",
  secondary: "badge-neutral",
  destructive: "badge-danger",
  outline: "badge-outline",
  ghost: "badge-ghost",
  link: "badge-ghost underline underline-offset-3",
}

function badgeVariants({ variant = "default" }: { variant?: BadgeVariant | null } = {}) {
  return cn("badge", VARIANT[variant ?? "default"])
}

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & { variant?: BadgeVariant | null }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
