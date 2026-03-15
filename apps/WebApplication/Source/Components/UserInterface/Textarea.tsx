import * as React from "react";

import { cn } from "@/Shared/Styling/ClassNameMerge";

const TEXTAREA_COMPONENT_DISPLAY_NAME = "Textarea";
const TEXTAREA_BASE_CLASS_NAME =
  "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export interface TextareaProps extends React.ComponentProps<"textarea"> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return <textarea className={cn(TEXTAREA_BASE_CLASS_NAME, className)} ref={ref} {...props} />;
  },
);
Textarea.displayName = TEXTAREA_COMPONENT_DISPLAY_NAME;

export { Textarea };
