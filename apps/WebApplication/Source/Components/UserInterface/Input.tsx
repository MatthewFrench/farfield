import * as React from "react";

import { cn } from "@/Shared/Styling/ClassNameMerge";

const INPUT_COMPONENT_DISPLAY_NAME = "Input";
const DEFAULT_INPUT_TYPE = "text";
const INPUT_BASE_CLASS_NAME =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export interface InputProps extends React.ComponentProps<"input"> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = DEFAULT_INPUT_TYPE, ...props }, ref) => {
    return (
      <input type={type} className={cn(INPUT_BASE_CLASS_NAME, className)} ref={ref} {...props} />
    );
  },
);
Input.displayName = INPUT_COMPONENT_DISPLAY_NAME;

export { Input };
