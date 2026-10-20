import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Card = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="card"
    className={cn(
      "flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-[0_12px_36px_rgba(0,0,0,0.22)] backdrop-blur-md",
      className,
    )}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="card-header"
    className={cn(
      "flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3",
      className,
    )}
    {...props}
  />
);

export const CardTitle = ({ className, ...props }: ComponentProps<"h2">) => (
  <h2
    data-slot="card-title"
    className={cn("text-[15px] font-semibold tracking-tight", className)}
    {...props}
  />
);

export const CardContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div data-slot="card-content" className={cn("px-4 py-3", className)} {...props} />
);
