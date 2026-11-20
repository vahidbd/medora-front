import { cn } from "@/lib/utils"

/** The kit's skeleton bar: 8px corners and a slow shimmer. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
