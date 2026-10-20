import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Progress = ({
  className,
  value,
  indicatorClassName,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) => (
  <ProgressPrimitive.Root
    data-slot="progress"
    className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full w-full flex-1 rounded-full bg-gradient-to-r from-[#cd8a1f] to-[#ffcf70] transition-transform duration-300",
        indicatorClassName,
      )}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
);
