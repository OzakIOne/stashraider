import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Input = ({ className, type, ...props }: ComponentProps<"input">) => (
  <input
    type={type}
    data-slot="input"
    className={cn(
      "flex h-9 w-full min-w-0 rounded-md border border-input bg-black/30 px-2.5 py-1 text-sm text-foreground shadow-xs transition-[color,border-color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/40",
      className,
    )}
    {...props}
  />
);
