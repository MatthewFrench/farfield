import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

const CARD_COMPONENT_DISPLAY_NAME = "Card";
const CARD_BASE_CLASS_NAME = "rounded-lg border border-border bg-card";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn(CARD_BASE_CLASS_NAME, className)} {...props} />;
});
Card.displayName = CARD_COMPONENT_DISPLAY_NAME;
