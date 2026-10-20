import {
  Command as CommandRoot,
  CommandEmpty as CommandEmptyRoot,
  CommandGroup as CommandGroupRoot,
  CommandInput as CommandInputRoot,
  CommandItem as CommandItemRoot,
  CommandList as CommandListRoot,
} from "cmdk";
import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Command = ({ className, ...props }: ComponentProps<typeof CommandRoot>) => (
  <CommandRoot
    data-slot="command"
    className={cn(
      "flex h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
);

export const CommandInput = ({ className, ...props }: ComponentProps<typeof CommandInputRoot>) => (
  <div
    data-slot="command-input-wrapper"
    className="flex h-9 items-center gap-2 border-b border-border px-3"
  >
    <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
    <CommandInputRoot
      data-slot="command-input"
      className={cn(
        "flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
);

export const CommandList = ({ className, ...props }: ComponentProps<typeof CommandListRoot>) => (
  <CommandListRoot
    data-slot="command-list"
    className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
    {...props}
  />
);

export const CommandEmpty = (props: ComponentProps<typeof CommandEmptyRoot>) => (
  <CommandEmptyRoot
    data-slot="command-empty"
    className="py-6 text-center text-xs text-muted-foreground"
    {...props}
  />
);

export const CommandGroup = ({ className, ...props }: ComponentProps<typeof CommandGroupRoot>) => (
  <CommandGroupRoot
    data-slot="command-group"
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/80 [&_[cmdk-group-heading]]:uppercase",
      className,
    )}
    {...props}
  />
);

export const CommandItem = ({ className, ...props }: ComponentProps<typeof CommandItemRoot>) => (
  <CommandItemRoot
    data-slot="command-item"
    className={cn(
      "relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
      className,
    )}
    {...props}
  />
);
