import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />;
});
CardDescription.displayName = "CardDescription";
