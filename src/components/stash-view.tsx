import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { catalog, hiddenFromLoot, typeLabel, type CatalogItem } from "@/lib/catalog";
import { MAX_CAPACITY } from "@/lib/constants";
import {
  bestValue,
  capacityAdvice,
  formatCredits,
  planRetention,
  recommend,
  retentionRecommendation,
  statsForLines,
  type Goal,
  type InventoryLine,
  type ValueMode,
} from "@/lib/optimizer";
import { cn } from "@/lib/utils";
import { GoalsPanel } from "./goals-panel";
import { InventoryImport } from "./inventory-import";
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

type SortMode = "density" | "name" | "slots";

const sortModes: SortMode[] = ["density", "name", "slots"];

const isSortMode = (value: string): value is SortMode => sortModes.some((mode) => mode === value);

export const StashView = ({
  inventory,
  setInventory,
  capacity,
  setCapacity,
  mode,
  setMode,
  onInspect,
  onLoadDemo,
  goals,
  setGoals,
}: {
  inventory: InventoryLine[];
  setInventory: Dispatch<SetStateAction<InventoryLine[]>>;
  capacity: number;
  setCapacity: (capacity: number) => void;
  mode: ValueMode;
  setMode: (mode: ValueMode) => void;
  onInspect: (item: CatalogItem) => void;
  onLoadDemo: () => void;
  goals: Goal[];
  setGoals: Dispatch<SetStateAction<Goal[]>>;
}) => {
  const [sort, setSort] = useState<SortMode>("density");
  const targets = useMemo(
    () =>
      catalog.items
        .filter((item) => !hiddenFromLoot.has(item.type))
        .sort(
          (left, right) =>
            typeLabel(left.type).localeCompare(typeLabel(right.type), "fr") ||
            left.name.localeCompare(right.name, "fr"),
        ),
    [],
  );
  const retention = useMemo(() => planRetention(inventory, goals), [inventory, goals]);

  const summary = useMemo(() => {
    const stats = statsForLines(inventory);
    const slots = stats.reduce((total, line) => total + line.slots, 0);
    const sellValue = stats.reduce((total, line) => total + line.sellValue, 0);
    const recycleValue = stats.reduce((total, line) => total + line.recycleValue, 0);
    return {
      stats,
      slots,
      sellValue,
      recycleValue,
      density: slots > 0 ? Math.max(sellValue, recycleValue) / slots : 0,
    };
  }, [inventory]);

  const plans = useMemo(
    () =>
      summary.stats
        .map((stats) => {
          const keep = retention.keepById[stats.item.id];
          return {
            stats,
            keepQty: keep?.qty ?? 0,
            recommendation: keep ? retentionRecommendation(stats, keep) : recommend(stats),
          };
        })
        .sort((left, right) => {
          if (sort === "name")
            return left.stats.item.name.localeCompare(right.stats.item.name, "fr");
          if (sort === "slots") return right.stats.slots - left.stats.slots;
          return right.stats.density - left.stats.density;
        }),
    [summary, sort, retention],
  );

  const used = summary.slots;
  const sellTotal = summary.sellValue;
  const recycleTotal = summary.recycleValue;
  const averageDensity = summary.density;
  const advice = useMemo(
    () => capacityAdvice(inventory, capacity, mode),
    [inventory, capacity, mode],
  );
  const counts = plans.reduce(
    (accumulator, plan) => {
      accumulator[plan.recommendation.kind] += 1;
      return accumulator;
    },
    { recycle: 0, sell: 0, keep: 0 },
  );

  const addItem = (item: CatalogItem, qty = 1) => {
    setInventory((lines) => {
      const existing = lines.find((line) => line.id === item.id);
      if (existing) {
        return lines.map((line) => (line.id === item.id ? { ...line, qty: line.qty + qty } : line));
      }
      return [...lines, { id: item.id, qty }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setInventory((lines) =>
      qty <= 0
        ? lines.filter((line) => line.id !== id)
        : lines.map((line) => (line.id === id ? { ...line, qty } : line)),
    );
  };

  const importInventory = (lines: InventoryLine[]) => {
    setInventory((current) => {
      const merged = new Map(current.map((line) => [line.id, line.qty]));
      for (const line of lines) merged.set(line.id, (merged.get(line.id) ?? 0) + line.qty);
      return [...merged].map(([id, qty]) => ({ id, qty }));
    });
  };

  const addGoal = (goal: Goal) => {
    setGoals((current) =>
      current.some((entry) => entry.id === goal.id)
        ? current.map((entry) => (entry.id === goal.id ? goal : entry))
        : [...current, goal],
    );
  };

  const updateGoal = (id: string, qty: number) => {
    setGoals((current) =>
      qty <= 0
        ? current.filter((entry) => entry.id !== id)
        : current.map((entry) => (entry.id === id ? { ...entry, qty } : entry)),
    );
  };

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="Ajouter du butin" className="lg:sticky lg:top-[4.5rem]">
        <InventoryImport onImport={importInventory} />
        <ItemSearch
          onPick={addItem}
          onPickStack={(item) => addItem(item, item.stack)}
          exclude={new Set(inventory.map((line) => line.id))}
        />
      </Panel>

      <div className="flex min-w-0 flex-col gap-3">
        <Panel
          title="Mon stash"
          description="Garde, vends ou recycle chaque slot"
          className="gap-0"
          actions={
            <>
              <label className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Capacité
                <NumberInput
                  min={1}
                  max={MAX_CAPACITY}
                  name="stash-capacity"
                  value={capacity}
                  onCommit={setCapacity}
                  aria-label="Capacité du stash"
                  className="h-7 w-16 px-1.5 text-center text-xs tabular-nums"
                />
              </label>
              <ValueModeToggle mode={mode} onChange={setMode} />
            </>
          }
        >
          <div className="border-b border-border px-4 py-3">
            <CapacityBar used={used} capacity={capacity} />
          </div>

          <GoalsPanel
            goals={goals}
            plan={retention}
            targets={targets}
            onAdd={addGoal}
            onUpdate={updateGoal}
            onRemove={(id) => updateGoal(id, 0)}
          />

          <div className="grid grid-cols-2 gap-2 px-4 pt-3 md:grid-cols-4">
            <Stat
              label="Slots occupés"
              value={`${used}`}
              hint={`${Math.max(0, capacity - used)} libres`}
            />
            <Stat label="Valeur revente" value={`${formatCredits(sellTotal)} CR`} />
            <Stat
              label="Valeur recyclage"
              value={`${formatCredits(recycleTotal)} CR`}
              hint={
                recycleTotal >= sellTotal
                  ? `+${formatCredits(recycleTotal - sellTotal)} CR`
                  : `${formatCredits(recycleTotal - sellTotal)} CR`
              }
              tone={recycleTotal >= sellTotal ? "ok" : undefined}
            />
            <Stat
              label="Densité moyenne"
              value={`${formatCredits(averageDensity)} CR`}
              hint="par slot"
              tone="accent"
            />
          </div>

          {goals.length > 0 ? (
            <div className="mx-4 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-success/20 bg-success/[0.03] px-3 py-1.5 text-[10.5px] text-muted-foreground">
              <span>
                <strong className="tabular-nums text-foreground">
                  {retention.coveredGoals}/{goals.length}
                </strong>{" "}
                objectifs couverts
              </span>
              <span>
                <strong className="tabular-nums text-foreground">{retention.reservedLines}</strong>{" "}
                lignes réservées
              </span>
              <span>
                <strong className="tabular-nums text-foreground">{retention.surplusUnits}</strong>{" "}
                unités hors objectifs
              </span>
              <span>
                <strong className="tabular-nums text-foreground">
                  {formatCredits(retention.surplusValue)} CR
                </strong>{" "}
                de valeur brute
              </span>
            </div>
          ) : null}

          {plans.length === 0 ? (
            <EmptyState
              title="Ton stash est vide"
              text="Cherche un item à gauche et ajoute-le pour voir combien de slots il coûte, ce qu'il rapporte et s'il vaut mieux le garder, le vendre ou le recycler."
              action={
                <Button variant="outline" size="sm" onClick={onLoadDemo}>
                  Charger un stash d'exemple
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-xs">
                <ToneBadge tone="recycle">{counts.recycle} à recycler</ToneBadge>
                <ToneBadge tone="sell">{counts.sell} à vendre</ToneBadge>
                <ToneBadge tone="keep">{counts.keep} à garder</ToneBadge>
                <div className="ml-auto flex items-center gap-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Trier
                  <Select
                    value={sort}
                    onValueChange={(value) => {
                      if (isSortMode(value)) setSort(value);
                    }}
                  >
                    <SelectTrigger size="sm" aria-label="Trier le stash">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="density">Valeur / slot</SelectItem>
                      <SelectItem value="slots">Slots</SelectItem>
                      <SelectItem value="name">Nom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="xs" onClick={() => setInventory([])}>
                  Vider
                </Button>
              </div>

              {used > capacity ? (
                <div className="mx-4 mt-2 grid gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-xs">
                  <strong className="text-destructive">
                    Il manque {used - capacity} slot{used - capacity > 1 ? "s" : ""}.
                  </strong>
                  <span className="text-muted-foreground">
                    Les lignes les moins rentables à sortir en premier :
                  </span>
                  <div className="grid gap-1.5">
                    {advice.map((stats) => (
                      <button
                        type="button"
                        key={stats.item.id}
                        onClick={() => setQty(stats.item.id, 0)}
                        className="flex items-center gap-2 rounded-md border border-border bg-black/40 p-1.5 text-left transition-colors hover:border-destructive/40"
                      >
                        <ItemIcon item={stats.item} size="sm" />
                        <span className="grid flex-1 gap-px">
                          {stats.item.name}
                          <small className="text-[11px] text-muted-foreground">
                            {stats.slots} slot{stats.slots > 1 ? "s" : ""} ·{" "}
                            {formatCredits(bestValue(stats, mode) / Math.max(1, stats.slots))}{" "}
                            CR/slot
                          </small>
                        </span>
                        <span className="text-[10px] font-bold tracking-wider text-destructive uppercase">
                          Retirer
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-2 px-4 pb-4">
                <div className="hidden items-center gap-3 border-b border-border px-2 pb-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase md:grid md:grid-cols-[minmax(0,2fr)_132px_52px_118px_minmax(0,1.5fr)]">
                  <span>Item</span>
                  <span>Qté</span>
                  <span>Slots</span>
                  <span>Valeur</span>
                  <span>Verdict</span>
                </div>
                {plans.map(({ stats, recommendation, keepQty }) => {
                  const lineValue = bestValue(stats, mode);
                  return (
                    <div
                      key={stats.item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-border px-2 py-2.5 transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(0,2fr)_132px_52px_118px_minmax(0,1.5fr)] md:gap-3"
                    >
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
                        <QtyStepper
                          qty={stats.qty}
                          onChange={(qty) => setQty(stats.item.id, qty)}
                          compact
                        />
                        {stats.item.stack > 1 ? (
                          <button
                            type="button"
                            onClick={() => setQty(stats.item.id, stats.qty + stats.item.stack)}
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
                        <small className="text-[10px] text-muted-foreground">
                          slot{stats.slots > 1 ? "s" : ""}
                        </small>
                      </div>

                      <div className="col-start-2 row-start-2 grid justify-self-end text-right md:col-start-auto md:row-start-auto md:justify-self-start md:text-left">
                        <strong className="text-[13px] tabular-nums">
                          {formatCredits(lineValue)} CR
                        </strong>
                        <small className="text-[10px] text-muted-foreground tabular-nums">
                          {formatCredits(lineValue / Math.max(1, stats.slots))} / slot
                        </small>
                        <small className="text-[10px] text-primary tabular-nums md:hidden">
                          {stats.slots} slot{stats.slots > 1 ? "s" : ""}
                        </small>
                      </div>

                      <div className="col-span-2 grid gap-0.5 border-t border-dashed border-border pt-1.5 md:col-span-1 md:border-0 md:pt-0">
                        <span
                          className={cn(
                            "w-fit rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase",
                            recommendation.kind === "recycle" &&
                              "bg-rarity-epic/15 text-rarity-epic",
                            recommendation.kind === "sell" && "bg-rarity-rare/15 text-rarity-rare",
                            recommendation.kind === "keep" && "bg-success/15 text-success",
                          )}
                        >
                          {recommendation.label}
                        </span>
                        <small className="text-[10.5px] leading-snug text-muted-foreground">
                          {recommendation.detail}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};
