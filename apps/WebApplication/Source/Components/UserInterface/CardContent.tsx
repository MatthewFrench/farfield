import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

const CARD_CONTENT_COMPONENT_DISPLAY_NAME = "CardContent";
const CARD_CONTENT_BASE_CLASS_NAME = "p-4 pt-0";

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn(CARD_CONTENT_BASE_CLASS_NAME, className)} {...props} />;
  },
);
CardContent.displayName = CARD_CONTENT_COMPONENT_DISPLAY_NAME;
