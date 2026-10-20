import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/number-input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { rarityLabel, type CatalogItem } from "@/lib/catalog";
import { isRarity, type Rarity } from "@/lib/catalog-types";
import { CAPACITY_WARNING_RATIO } from "@/lib/constants";
import type { ValueMode } from "@/lib/line-stats";
import { cn } from "@/lib/utils";

const rarityFrame: Record<Rarity, string> = {
  Common: "border-rarity-common/35",
  Uncommon: "border-rarity-uncommon/45",
  Rare: "border-rarity-rare/50",
  Epic: "border-rarity-epic/55 shadow-[inset_0_0_18px_rgba(177,140,255,0.12)]",
  Legendary: "border-rarity-legendary/60 shadow-[inset_0_0_18px_rgba(255,194,71,0.14)]",
  Amplified: "border-rarity-amplified/60",
};

const rarityText: Record<Rarity, string> = {
  Common: "bg-rarity-common/15 text-rarity-common",
  Uncommon: "bg-rarity-uncommon/15 text-rarity-uncommon",
  Rare: "bg-rarity-rare/15 text-rarity-rare",
  Epic: "bg-rarity-epic/15 text-rarity-epic",
  Legendary: "bg-rarity-legendary/15 text-rarity-legendary",
  Amplified: "bg-rarity-amplified/15 text-rarity-amplified",
};

const rarityClasses = (
  rarity: string,
  classes: Record<Rarity, string>,
  fallback: string,
): string => (isRarity(rarity) ? classes[rarity] : fallback);

const iconSizes = {
  xs: "size-6 rounded-md text-[9px]",
  sm: "size-8 rounded-lg text-[10px]",
  md: "size-10 rounded-[10px] text-xs",
  lg: "size-14 rounded-xl text-sm",
  xl: "size-20 rounded-xl text-lg",
};

export const ItemIcon = ({
  item,
  size = "md",
  className,
}: {
  item: CatalogItem;
  size?: keyof typeof iconSizes;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);
  const initials = item.name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden border bg-[radial-gradient(circle_at_50%_35%,rgba(148,163,184,0.12),transparent_65%)] bg-black/50 font-extrabold text-muted-foreground",
        iconSizes[size],
        rarityClasses(item.rarity, rarityFrame, "border-border"),
        className,
      )}
    >
      {item.image && !failed ? (
        <img
          src={`${import.meta.env.BASE_URL}${item.image.replace(/^\//, "")}`}
          alt=""
          loading="lazy"
          className="size-full object-contain p-0.5 drop-shadow-[0_4px_8px_rgba(0,0,0,0.48)]"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export const RarityBadge = ({ item, className }: { item: CatalogItem; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded px-1.5 py-px text-[9px] font-bold tracking-wider uppercase",
      rarityClasses(item.rarity, rarityText, "bg-muted text-muted-foreground"),
      className,
    )}
  >
    {rarityLabel(item.rarity)}
  </span>
);

export const QtyStepper = ({
  qty,
  onChange,
  compact = false,
}: {
  qty: number;
  onChange: (qty: number) => void;
  compact?: boolean;
}) => (
  <div className="inline-flex items-center overflow-hidden rounded-md border border-input bg-black/30">
    <button
      type="button"
      onClick={() => onChange(qty - 1)}
      aria-label="Retirer un"
      className={cn(
        "grid place-items-center text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary",
        compact ? "size-7 text-sm" : "size-8 text-base",
      )}
    >
      −
    </button>
    <NumberInput
      min={1}
      value={qty}
      onCommit={onChange}
      name="quantity"
      aria-label="Quantité"
      className={cn(
        "rounded-none border-y-0 border-x border-border bg-transparent text-center font-bold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        compact ? "w-10 py-1 text-xs" : "w-12 py-1.5 text-[13px]",
      )}
    />
    <button
      type="button"
      onClick={() => onChange(qty + 1)}
      aria-label="Ajouter un"
      className={cn(
        "grid place-items-center text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary",
        compact ? "size-7 text-sm" : "size-8 text-base",
      )}
    >
      +
    </button>
  </div>
);

export const CapacityBar = ({
  used,
  capacity,
  compact = false,
}: {
  used: number;
  capacity: number;
  compact?: boolean;
}) => {
  const ratio = capacity > 0 ? used / capacity : 0;
  const over = used > capacity;
  return (
    <div className={cn("grid gap-1.5", compact && "gap-1")}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <strong className="font-bold tabular-nums text-foreground">{used}</strong> / {capacity}{" "}
          {capacity > 1 ? "slots" : "slot"}
        </span>
        <span
          className={cn(
            "tabular-nums",
            over
              ? "text-destructive"
              : ratio > CAPACITY_WARNING_RATIO
                ? "text-warning"
                : "text-muted-foreground",
          )}
        >
          {over ? `${used - capacity} de trop` : `${Math.max(0, capacity - used)} libres`}
        </span>
      </div>
      <Progress
        value={Math.min(100, ratio * 100)}
        aria-label="Occupation du stash"
        indicatorClassName={over ? "bg-gradient-to-r from-[#ff9a3d] to-destructive" : undefined}
      />
    </div>
  );
};

export const ValueModeToggle = ({
  mode,
  onChange,
  className,
}: {
  mode: ValueMode;
  onChange: (mode: ValueMode) => void;
  className?: string;
}) => (
  <div
    role="group"
    aria-label="Valorisation"
    className={cn("inline-flex rounded-lg border border-border bg-black/40 p-0.5", className)}
  >
    {(
      [
        ["sell", "Revente"],
        ["recycle", "Recyclage"],
      ] as const
    ).map(([value, label]) => (
      <button
        key={value}
        type="button"
        onClick={() => onChange(value)}
        aria-pressed={mode === value}
        className={cn(
          "rounded-[6px] px-2.5 py-1 text-xs font-semibold transition-colors",
          mode === value
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
      </button>
    ))}
  </div>
);

export const Panel = ({
  title,
  eyebrow,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) => (
  <Card className={className}>
    <CardHeader>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
            {eyebrow}
          </p>
        ) : null}
        <CardTitle className="truncate">{title}</CardTitle>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </CardHeader>
    <div className={contentClassName}>{children}</div>
  </Card>
);

export const EmptyState = ({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) => (
  <div className="grid justify-items-center gap-2 px-6 py-12 text-center">
    <div className="grid size-11 place-items-center rounded-xl border border-dashed border-input text-xl text-muted-foreground">
      ◫
    </div>
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="max-w-[54ch] text-xs text-muted-foreground">{text}</p>
    {action}
  </div>
);

export const Stat = ({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "accent" | "ok" | "danger";
  className?: string;
}) => (
  <div
    className={cn(
      "grid gap-0.5 rounded-lg border border-border bg-black/30 px-3 py-2",
      tone === "accent" && "border-primary/30 bg-primary/10",
      className,
    )}
  >
    <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
      {label}
    </span>
    <strong
      className={cn(
        "text-base font-bold tabular-nums",
        tone === "accent" && "text-primary",
        tone === "ok" && "text-success",
        tone === "danger" && "text-destructive",
      )}
    >
      {value}
    </strong>
    {hint ? <small className="text-[11px] text-muted-foreground">{hint}</small> : null}
  </div>
);

export const ToneBadge = ({
  tone,
  children,
  className,
}: {
  tone: "recycle" | "sell" | "keep";
  children: ReactNode;
  className?: string;
}) => (
  <Badge
    variant="outline"
    className={cn(
      "px-2 py-0.5",
      tone === "recycle" && "border-rarity-epic/35 bg-rarity-epic/12 text-rarity-epic",
      tone === "sell" && "border-rarity-rare/35 bg-rarity-rare/12 text-rarity-rare",
      tone === "keep" && "border-success/35 bg-success/12 text-success",
      className,
    )}
  >
    {children}
  </Badge>
);
