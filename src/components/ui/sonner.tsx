"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Every save result goes to the kit's save notice: bottom right, 20px from
 * the edges, 360 wide, a popover card that never blocks anything (beside an
 * open drawer it moves clear of the drawer's footer). The icon carries the
 * tone; the card stays neutral.
 */
type Position = NonNullable<ToasterProps["position"]>

/*
 * A drawer keeps its Save button bottom right, where the notices sit. While a
 * right-hand drawer is open they move clear of it: bottom left on a desktop,
 * top centre on a phone, where the drawer fills the screen.
 */
const PHONE = "(max-width: 640px)"

function subscribeToDrawers(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ending-style"] })
  const phone = window.matchMedia(PHONE)
  phone.addEventListener("change", onChange)
  return () => {
    observer.disconnect()
    phone.removeEventListener("change", onChange)
  }
}

function positionBesideDrawers(base: Position) {
  return (): Position => {
    if (!document.querySelector(".drawer-popup:not([data-side='left']):not([data-ending-style])")) return base
    return window.matchMedia(PHONE).matches ? "top-center" : "bottom-left"
  }
}

const Toaster = ({ position = "bottom-right", ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme()
  const placed = useSyncExternalStore(subscribeToDrawers, positionBesideDrawers(position), () => position)

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      offset={20}
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{ "--width": "var(--save-alert-w)" } as React.CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "save-alert",
          icon: "save-alert-icon",
          content: "save-alert-body",
          title: "save-alert-title",
          description: "save-alert-text",
          closeButton: "save-alert-close",
          error: "error",
          warning: "warning",
          info: "info",
          actionButton: "btn btn-sm btn-outline",
          cancelButton: "btn btn-sm btn-ghost",
        },
      }}
      {...props}
      position={placed}
    />
  )
}

export { Toaster }
