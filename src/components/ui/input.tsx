import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { DateField, DateTimeField, TimeField } from "@/components/ui/date-field"
import { NumberField } from "@/components/ui/number-field"

/**
 * The kit's input: 36 tall, 10px corners, 12px sides, a 3px halo on focus.
 * Date, time and date-time types render the kit's own fields (typed
 * DD/MM/YYYY and 24h HH:mm with a kit popover), never the browser's picker;
 * their value and onChange work as the native input's did. A number type
 * renders the kit's NumberField: a text input with a numeric keyboard, no
 * spinners, and nothing that changes on the wheel or the arrow keys.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "date") return <DateField className={className} {...(props as React.ComponentProps<typeof DateField>)} />
  if (type === "time") return <TimeField className={className} {...(props as React.ComponentProps<typeof TimeField>)} />
  if (type === "datetime-local")
    return <DateTimeField className={className} {...(props as React.ComponentProps<typeof DateTimeField>)} />
  if (type === "number") return <NumberField className={className} {...(props as React.ComponentProps<typeof NumberField>)} />
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "input min-w-0 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
