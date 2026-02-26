import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

const CARD_HEADER_COMPONENT_DISPLAY_NAME = "CardHeader";
const CARD_HEADER_BASE_CLASS_NAME = "flex flex-col gap-1.5 p-4";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn(CARD_HEADER_BASE_CLASS_NAME, className)} {...props} />;
  }
);
CardHeader.displayName = CARD_HEADER_COMPONENT_DISPLAY_NAME;
