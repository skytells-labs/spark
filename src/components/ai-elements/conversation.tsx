"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Conversation({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-0 flex-1 flex-col", className)} {...props} />;
}

export function ConversationContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative min-h-0 flex-1 overflow-y-auto px-3 py-5", className)}
      {...props}
    />
  );
}
