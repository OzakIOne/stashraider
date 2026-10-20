import { useEffect, useState, type ComponentProps, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { MAX_QTY } from "@/lib/constants";

type NumberInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
};

export const NumberInput = ({
  value,
  onCommit,
  min = 1,
  max = MAX_QTY,
  onBlur,
  onKeyDown,
  ...props
}: NumberInputProps) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : min;
    setDraft(String(next));
    onCommit(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit(draft);
    onKeyDown?.(event);
  };

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const parsed = Number(raw);
        if (raw.trim() !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
          onCommit(Math.trunc(parsed));
        }
      }}
      onBlur={(event) => {
        commit(draft);
        onBlur?.(event);
      }}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
};
