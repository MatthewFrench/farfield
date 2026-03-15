import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

const TABS_COMPONENT_DISPLAY_NAME = "Tabs";

export const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>((props, ref) => {
  return <TabsPrimitive.Root ref={ref} {...props} />;
});

Tabs.displayName = TABS_COMPONENT_DISPLAY_NAME;
