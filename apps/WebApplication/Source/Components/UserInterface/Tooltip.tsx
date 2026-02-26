import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/Shared/Styling/ClassNameMerge"

const TOOLTIP_PROVIDER_DELAY_DURATION_MILLISECONDS = 0
const TOOLTIP_CONTENT_SIDE_OFFSET_PIXELS = 0
const TOOLTIP_COMPONENT_DISPLAY_NAME = "Tooltip"
const TOOLTIP_CONTENT_COMPONENT_DISPLAY_NAME = "TooltipContent"
const TOOLTIP_PROVIDER_COMPONENT_DISPLAY_NAME = "TooltipProvider"
const TOOLTIP_TRIGGER_COMPONENT_DISPLAY_NAME = "TooltipTrigger"

function TooltipProvider({
  delayDuration = TOOLTIP_PROVIDER_DELAY_DURATION_MILLISECONDS,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = TOOLTIP_CONTENT_SIDE_OFFSET_PIXELS,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

Tooltip.displayName = TOOLTIP_COMPONENT_DISPLAY_NAME
TooltipContent.displayName = TOOLTIP_CONTENT_COMPONENT_DISPLAY_NAME
TooltipProvider.displayName = TOOLTIP_PROVIDER_COMPONENT_DISPLAY_NAME
TooltipTrigger.displayName = TOOLTIP_TRIGGER_COMPONENT_DISPLAY_NAME

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
