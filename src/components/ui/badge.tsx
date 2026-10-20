import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md border px-1.5 py-px text-[10px] font-semibold whitespace-nowrap transition-colors [&>svg]:size-2.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        secondary: "border-transparent bg-secondary text-muted-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        muted: "border-border bg-black/20 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export const Badge = ({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) => (
  <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
);
