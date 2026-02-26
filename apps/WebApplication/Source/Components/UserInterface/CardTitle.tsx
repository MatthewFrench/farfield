import * as React from "react";
import { cn } from "@/Shared/Styling/ClassNameMerge";

const CARD_TITLE_COMPONENT_DISPLAY_NAME = "CardTitle";
const CARD_TITLE_BASE_CLASS_NAME = "text-sm font-semibold tracking-tight";

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => {
    return <h3 ref={ref} className={cn(CARD_TITLE_BASE_CLASS_NAME, className)} {...props} />;
  }
);
CardTitle.displayName = CARD_TITLE_COMPONENT_DISPLAY_NAME;
