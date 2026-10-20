import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { typeLabel, type CatalogItem } from "@/lib/catalog";
import {
  bestValue,
  formatCredits,
  statsForLines,
  totalSlots,
  type InventoryLine,
  type ValueMode,
} from "@/lib/line-stats";
import { cn } from "@/lib/utils";
import { ItemSearch } from "./item-search";
import {
  CapacityBar,
  EmptyState,
  ItemIcon,
  Panel,
  QtyStepper,
  RarityBadge,
  Stat,
  ToneBadge,
  ValueModeToggle,
} from "./ui";

type RankedLoot = {
  stats: ReturnType<typeof statsForLines>[number];
  take: boolean;
  rank: number;
};

export const LootView = ({
  inventory,
  loot,
  setLoot,
  capacity,
  mode,
  setMode,
  onInspect,
  onSendToStash,
}: {
  inventory: InventoryLine[];
  loot: InventoryLine[];
  setLoot: Dispatch<SetStateAction<InventoryLine[]>>;
  capacity: number;
  mode: ValueMode;
  setMode: (mode: ValueMode) => void;
  onInspect: (item: CatalogItem) => void;
  onSendToStash: (lines: InventoryLine[]) => void;
}) => {
  const stashSlots = totalSlots(inventory);
  const freeSlots = Math.max(0, capacity - stashSlots);
  const candidates = useMemo(
    () =>
      statsForLines(loot).sort(
        (left, right) =>
          bestValue(right, mode) / Math.max(1, right.slots) -
          bestValue(left, mode) / Math.max(1, left.slots),
      ),
    [loot, mode],
  );

  const ranked: RankedLoot[] = useMemo(() => {
    let remaining = freeSlots;
    return candidates.map((stats, index) => {
      const take = stats.slots <= remaining;
      if (take) remaining -= stats.slots;
      return { stats, take, rank: index + 1 };
    });
  }, [candidates, freeSlots]);

  const retained = ranked.filter((entry) => entry.take);
  const retainedSlots = retained.reduce((total, entry) => total + entry.stats.slots, 0);
  const retainedValue = retained.reduce((total, entry) => total + bestValue(entry.stats, mode), 0);

  const addItem = (item: CatalogItem, qty = 1) => {
    setLoot((lines) => {
      const existing = lines.find((line) => line.id === item.id);
      if (existing) {
        return lines.map((line) => (line.id === item.id ? { ...line, qty: line.qty + qty } : line));
      }
      return [...lines, { id: item.id, qty }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setLoot((lines) =>
      qty <= 0
        ? lines.filter((line) => line.id !== id)
        : lines.map((line) => (line.id === id ? { ...line, qty } : line)),
    );
  };

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Panel
        title="Butin candidat"
        description="Ce que tu hésites à ramener"
        className="lg:sticky lg:top-[4.5rem]"
      >
        <ItemSearch
          onPick={addItem}
          onPickStack={(item) => addItem(item, item.stack)}
          exclude={new Set(loot.map((line) => line.id))}
        />
      </Panel>

      <div className="flex min-w-0 flex-col gap-3">
        <Panel
          title="Optimiseur de raid"
          description={`${freeSlots} slot${freeSlots > 1 ? "s" : ""} libre${freeSlots > 1 ? "s" : ""} dans le stash`}
          className="gap-0"
          actions={<ValueModeToggle mode={mode} onChange={setMode} />}
        >
          <div className="border-b border-border px-4 py-3">
            <CapacityBar used={stashSlots} capacity={capacity} />
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 pt-3">
            <Stat
              label="Place libre"
              value={`${freeSlots}`}
              hint="slots"
              tone={freeSlots > 0 ? "ok" : "danger"}
            />
            <Stat
              label="Butin retenu"
              value={`${retainedSlots}`}
              hint={`${retained.length} ligne${retained.length > 1 ? "s" : ""}`}
            />
            <Stat
              label="Valeur retenue"
              value={`${formatCredits(retainedValue)} CR`}
              hint={mode === "sell" ? "à la revente" : "en matériaux"}
              tone="accent"
            />
          </div>

          {ranked.length === 0 ? (
            <EmptyState
              title="Aucun butin en lice"
              text="Ajoute les items que tu peux ramener du raid. Le classement se fait à la valeur par slot : ce qui rentre dans le stash sans gaspiller de place passe en premier."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-xs">
                <ToneBadge tone="keep">{retained.length} à prendre</ToneBadge>
                <ToneBadge tone="sell">{ranked.length - retained.length} à laisser</ToneBadge>
                <span className="text-[10.5px] text-muted-foreground">
                  Classement par {mode === "sell" ? "revente" : "recyclage"} / slot
                </span>
                <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setLoot([])}>
                  Vider
                </Button>
              </div>

              {freeSlots === 0 && ranked.length > 0 ? (
                <div className="mx-4 mt-2 grid gap-1 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-xs">
                  <strong className="text-destructive">Stash plein.</strong>
                  <span className="text-muted-foreground">
                    Libère de la place dans l'onglet Stash, ou remplace une ligne par un item plus
                    rentable.
                  </span>
                </div>
              ) : null}

              <div className="mt-2 grid gap-1.5 px-4 pb-2">
                {ranked.map(({ stats, take, rank }) => {
                  const value = bestValue(stats, mode);
                  return (
                    <div
                      key={stats.item.id}
                      className={cn(
                        "grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-border bg-black/20 px-2.5 py-2 md:grid-cols-[26px_minmax(0,2fr)_104px_52px_118px_72px] md:gap-3",
                        take && "border-success/25 bg-success/[0.035]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-6 place-items-center rounded-md border border-border text-[11px] font-bold tabular-nums text-muted-foreground",
                          rank <= 3 && "border-primary/45 bg-primary/10 text-primary",
                        )}
                      >
                        {rank}
                      </span>
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
                          </small>
                        </span>
                      </button>

                      <div className="justify-self-end md:justify-self-start">
                        <QtyStepper
                          qty={stats.qty}
                          onChange={(qty) => setQty(stats.item.id, qty)}
                          compact
                        />
                      </div>

                      <div className="hidden md:grid">
                        <strong className="text-[13px] tabular-nums">{stats.slots}</strong>
                        <small className="text-[10px] text-muted-foreground">
                          slot{stats.slots > 1 ? "s" : ""}
                        </small>
                      </div>

                      <div className="col-start-2 row-start-2 grid justify-self-end text-right md:col-start-auto md:row-start-auto md:justify-self-start md:text-left">
                        <strong className="text-[13px] tabular-nums">
                          {formatCredits(value)} CR
                        </strong>
                        <small className="text-[10px] text-muted-foreground tabular-nums">
                          {formatCredits(value / Math.max(1, stats.slots))} / slot
                        </small>
                        <small className="text-[10px] text-primary tabular-nums md:hidden">
                          {stats.slots} slot{stats.slots > 1 ? "s" : ""}
                        </small>
                      </div>

                      <span
                        className={cn(
                          "col-start-3 row-start-2 w-fit justify-self-end rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase md:col-start-auto md:row-start-auto md:justify-self-start",
                          take
                            ? "bg-success/15 text-success"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {take ? "Prendre" : "Laisser"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {retained.length > 0 ? (
                <div className="mx-4 mb-4 flex flex-col items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 sm:flex-row sm:items-center">
                  <div className="grid gap-0.5">
                    <strong className="text-lg tabular-nums">
                      {formatCredits(retainedValue)} CR
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      dans {retainedSlots} slot{retainedSlots > 1 ? "s" : ""}, il restera{" "}
                      {Math.max(0, freeSlots - retainedSlots)} slot
                      {freeSlots - retainedSlots > 1 ? "s" : ""} libre
                      {freeSlots - retainedSlots > 1 ? "s" : ""}.
                    </span>
                  </div>
                  <Button
                    onClick={() =>
                      onSendToStash(
                        retained.map((entry) => ({
                          id: entry.stats.item.id,
                          qty: entry.stats.qty,
                        })),
                      )
                    }
                  >
                    Transférer au stash
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};
