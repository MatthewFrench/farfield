import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

const CARD_DESCRIPTION_COMPONENT_DISPLAY_NAME = "CardDescription";
const CARD_DESCRIPTION_BASE_CLASS_NAME = "text-xs text-muted-foreground";

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => {
    return <p ref={ref} className={cn(CARD_DESCRIPTION_BASE_CLASS_NAME, className)} {...props} />;
  },
);
CardDescription.displayName = CARD_DESCRIPTION_COMPONENT_DISPLAY_NAME;
