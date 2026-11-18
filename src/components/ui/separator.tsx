"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  className?: string;
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export function Separator({ className, orientation = "horizontal", decorative = true, ...props }: SeparatorProps) {
  return (
    <hr
      className={cn(
        "relative w-full bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className,
      )}
      aria-orientation={orientation}
      aria-hidden={decorative}
      {...props}
    />
  );
}
