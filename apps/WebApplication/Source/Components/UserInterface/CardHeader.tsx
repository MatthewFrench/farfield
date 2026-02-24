import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
  }
);
CardHeader.displayName = "CardHeader";
