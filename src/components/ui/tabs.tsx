"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"
import { SegPill } from "@/components/ui/seg-pill"

/**
 * The kit's two tab shapes. `variant="default"` is segmented tabs (a 3px
 * track on muted, 32px tabs, the chosen one raised): a list's filters by
 * status, or a small view switch. `variant="line"` is underline tabs (44 tall,
 * 28 apart, a 2px underline): more than one list on a page, one at a time.
 * In segmented tabs the raised pill slides between tabs (SegPill).
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-4 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

function tabsListVariants({ variant = "default" }: { variant?: "default" | "line" | null } = {}) {
  return variant === "line" ? "tabs-underline" : "tabs-seg"
}

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & { variant?: "default" | "line" | null }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      {variant === "line" ? null : <SegPill />}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn("tab-u", className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
