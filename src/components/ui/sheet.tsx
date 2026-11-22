"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content>;

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ className, children, ...props }, ref) => (
    <SheetPrimitive.Content
      ref={ref}
      className={cn("fixed left-0 top-0 z-50 h-dvh w-full flex flex-col", className)}
      {...props}
    >
      <SheetPrimitive.Close className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none" />
      <SheetPrimitive.Title className="text-xl font-black tracking-tight" />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </SheetPrimitive.Content>
  ),
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

export { Sheet, SheetTrigger, SheetContent };
