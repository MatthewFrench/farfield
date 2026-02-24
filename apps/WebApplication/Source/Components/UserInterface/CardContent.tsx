import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />;
  }
);
CardContent.displayName = "CardContent";
