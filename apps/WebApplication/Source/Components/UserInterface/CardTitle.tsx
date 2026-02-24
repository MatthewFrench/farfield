import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return <h3 ref={ref} className={cn("text-sm font-semibold tracking-tight", className)} {...props} />;
  }
);
CardTitle.displayName = "CardTitle";
