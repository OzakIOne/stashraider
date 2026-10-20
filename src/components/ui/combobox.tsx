import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  group?: string;
  keywords?: string[];
  leading?: ReactNode;
  meta?: ReactNode;
};

export const Combobox = ({
  options,
  value,
  onChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  emptyText = "Aucun résultat.",
  ariaLabel,
  className,
  contentClassName,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const groups = useMemo(() => {
    const byGroup = new Map<string, ComboboxOption[]>();
    for (const option of options) {
      const key = option.group ?? "";
      byGroup.set(key, [...(byGroup.get(key) ?? []), option]);
    }
    return [...byGroup];
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn("h-9 w-full justify-between gap-2 font-normal", className)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selected?.leading}
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
          </span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-(--radix-popover-trigger-width) p-0", contentClassName)}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map(([group, entries]) => (
              <CommandGroup key={group} heading={group || undefined}>
                {entries.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, ...(option.keywords ?? [])]}
                    onSelect={(next) => {
                      onChange(next);
                      setOpen(false);
                    }}
                  >
                    {option.leading}
                    <span className="truncate">{option.label}</span>
                    {option.meta ? (
                      <span className="ml-auto flex items-center gap-2">{option.meta}</span>
                    ) : null}
                    {option.value === value ? (
                      <CheckIcon
                        className={cn("size-3.5 shrink-0 text-primary", !option.meta && "ml-auto")}
                      />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
