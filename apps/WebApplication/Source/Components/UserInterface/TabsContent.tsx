import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

const TABS_CONTENT_COMPONENT_DISPLAY_NAME = "TabsContent";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  return <TabsPrimitive.Content ref={ref} className={cn("mt-4", className)} {...props} />;
});
TabsContent.displayName = TABS_CONTENT_COMPONENT_DISPLAY_NAME;
