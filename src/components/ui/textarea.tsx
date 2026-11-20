import * as React from "react"

import { cn } from "@/lib/utils"

/** The kit's textarea: the input's border and focus, 10/12 padding, 1.55 lines. It grows with its text, so there is no resize grip. */
function Textarea({ className, rows, style, ...props }: React.ComponentProps<"textarea">) {
  // The box grows with its text; `rows` sets how tall it starts (1.55 lines
  // plus the kit's 10px padding and the border), 84px when not given.
  const minHeight = rows ? `calc(${rows} * 1.55em + 2 * var(--space-10) + 2px)` : undefined
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        "input field-sizing-content resize-none aria-invalid:border-destructive",
        !rows && "min-h-[84px]",
        className
      )}
      style={minHeight ? { minHeight, ...style } : style}
      {...props}
    />
  )
}

export { Textarea }
