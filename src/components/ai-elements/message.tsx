"use client";

import * as React from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

export function Message({
  from,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "mb-5 flex w-full",
        from === "user" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({
  from = "assistant",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { from?: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "text-sm leading-6",
        from === "user"
          ? "max-w-[78%] rounded-full bg-[#242424] px-4 py-2 text-[14px] leading-5 text-white/92 shadow-sm"
          : "w-full max-w-[94%] text-white/90",
        className,
      )}
      {...props}
    />
  );
}

export function MessageResponse({ children, isAnimating }: { children: React.ReactNode; isAnimating?: boolean }) {
  if (typeof children === "string") {
    return (
      <Streamdown
        isAnimating={isAnimating}
        className="prose prose-invert max-w-none text-pretty prose-p:my-2 prose-pre:rounded-md prose-pre:border prose-pre:border-white/10 prose-pre:bg-[#090909]"
      >
        {children}
      </Streamdown>
    );
  }

  return <div className="whitespace-pre-wrap text-pretty">{children}</div>;
}
