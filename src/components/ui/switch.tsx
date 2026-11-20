"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/** The kit's switch: a 36 × 20 track and a 16px knob, primary when on. */
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn("switch-track peer", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className="switch-knob" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
