import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/Shared/Styling/ClassNameMerge";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  return <TabsPrimitive.Content ref={ref} className={cn("mt-4", className)} {...props} />;
});
TabsContent.displayName = TabsPrimitive.Content.displayName;
