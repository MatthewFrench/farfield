import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("rounded-lg border border-border bg-card", className)} {...props} />;
  }
);
Card.displayName = "Card";
