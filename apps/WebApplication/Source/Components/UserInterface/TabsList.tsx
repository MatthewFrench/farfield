import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

const TABS_LIST_COMPONENT_DISPLAY_NAME = "TabsList";

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("inline-flex h-9 items-center rounded-md bg-muted p-1", className)}
      {...props}
    />
  );
});
TabsList.displayName = TABS_LIST_COMPONENT_DISPLAY_NAME;
