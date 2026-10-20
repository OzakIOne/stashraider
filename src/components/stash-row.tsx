import { Badge } from "@/components/ui/badge";
import { typeLabel, type CatalogItem } from "@/lib/catalog";
import { plural, recommendationDetail, recommendationLabel } from "@/lib/copy";
import { bestValue, formatCredits, type LineStats, type ValueMode } from "@/lib/line-stats";
import type { ActionKind, Recommendation } from "@/lib/recommend";
import { cn } from "@/lib/utils";
import { ItemIcon, QtyStepper, RarityBadge } from "./ui";

const verdictTone: Record<ActionKind, string> = {
  recycle: "bg-rarity-epic/15 text-rarity-epic",
  sell: "bg-rarity-rare/15 text-rarity-rare",
  keep: "bg-success/15 text-success",
};

type StashRowProps = {
  stats: LineStats;
  recommendation: Recommendation;
  keepQty: number;
  mode: ValueMode;
  onInspect: (item: CatalogItem) => void;
  onChangeQty: (qty: number) => void;
};

export const StashRow = ({
  stats,
  recommendation,
  keepQty,
  mode,
  onInspect,
  onChangeQty,
}: StashRowProps) => {
  const lineValue = bestValue(stats, mode);
  const perSlot = lineValue / Math.max(1, stats.slots);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-border px-2 py-2.5 transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(0,2fr)_132px_52px_118px_minmax(0,1.5fr)] md:gap-3">
      <button
        type="button"
        onClick={() => onInspect(stats.item)}
        className="flex min-w-0 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ItemIcon item={stats.item} />
        <span className="grid min-w-0 gap-0.5">
          <strong className="line-clamp-2 text-[13px] leading-tight font-semibold">
            {stats.item.name}
          </strong>
          <small className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <RarityBadge item={stats.item} />
            {typeLabel(stats.item.type)} · stack {stats.item.stack}
            {keepQty > 0 ? (
              <Badge variant="default" className="text-[8px]">
                Objectif
              </Badge>
            ) : null}
          </small>
        </span>
      </button>

      <div className="flex items-center justify-end gap-1 md:justify-start">
        <QtyStepper qty={stats.qty} onChange={onChangeQty} compact />
        {stats.item.stack > 1 ? (
          <button
            type="button"
            onClick={() => onChangeQty(stats.qty + stats.item.stack)}
            title={`Ajouter un stack complet (${stats.item.stack})`}
            aria-label={`Ajouter un stack complet de ${stats.item.name} (${stats.item.stack})`}
            className="h-7 rounded-md border border-primary/40 bg-primary/10 px-1.5 text-[9.5px] font-extrabold tabular-nums text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            +{stats.item.stack}
          </button>
        ) : null}
      </div>

      <div className="hidden md:grid">
        <strong className="text-[13px] tabular-nums">{stats.slots}</strong>
        <small className="text-[10px] text-muted-foreground">{plural(stats.slots, "slot")}</small>
      </div>

      <div className="col-start-2 row-start-2 grid justify-self-end text-right md:col-start-auto md:row-start-auto md:justify-self-start md:text-left">
        <strong className="text-[13px] tabular-nums">{formatCredits(lineValue)} CR</strong>
        <small className="text-[10px] text-muted-foreground tabular-nums">
          {formatCredits(perSlot)} / slot
        </small>
        <small className="text-[10px] text-primary tabular-nums md:hidden">
          {plural(stats.slots, "slot")}
        </small>
      </div>

      <div className="col-span-2 grid gap-0.5 border-t border-dashed border-border pt-1.5 md:col-span-1 md:border-0 md:pt-0">
        <span
          className={cn(
            "w-fit rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase",
            verdictTone[recommendation.kind],
          )}
        >
          {recommendationLabel(recommendation)}
        </span>
        <small className="text-[10.5px] leading-snug text-muted-foreground">
          {recommendationDetail(recommendation)}
        </small>
      </div>
    </div>
  );
};
