"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content>;

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, ...props }, ref) => (
    <DialogPrimitive.Content
      ref={ref}
      className={cn("fixed z-50 gap-4 rounded-xl border border-border bg-background p-6 shadow-lg", className)}
      {...props}
    >
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none" />
      <div className="grid gap-1">
        <DialogPrimitive.Title className="text-xl font-black tracking-tight" />
        <DialogPrimitive.Description className="text-sm text-text-secondary" />
      </div>
      <div className="grid gap-4 mt-2">{children}</div>
    </DialogPrimitive.Content>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

type DialogTitleProps = React.ComponentProps<typeof DialogPrimitive.Title>;

const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn("text-xl font-black tracking-tight", className)} {...props} />
  ),
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

type DialogDescriptionProps = React.ComponentProps<typeof DialogPrimitive.Description>;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-text-secondary", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription };
