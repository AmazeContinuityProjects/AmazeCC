"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List>;

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-surface-secondary p-1 text-text-muted",
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = TabsPrimitive.List.displayName;

type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps & { value: string }
>(({ className, value, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    value={value}
    className={cn(
      "rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-background data-[state=active]:text-text-heading data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content>;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps & { value: string }
>(({ className, value, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    value={value}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
