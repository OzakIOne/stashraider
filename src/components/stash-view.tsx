import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
import type { ItemId } from "@/lib/catalog-types";
import { MAX_CAPACITY } from "@/lib/constants";
import { plural } from "@/lib/copy";
import {
  bestValue,
  capacityAdvice,
  formatCredits,
  summarizeLines,
  type InventoryLine,
  type ValueMode,
} from "@/lib/line-stats";
import { objectiveAdvice, recommend } from "@/lib/recommend";
import { planRetention, type Goal } from "@/lib/retention";
import { GoalsPanel } from "./goals-panel";
import { InventoryImport } from "./inventory-import";
import { ItemSearch } from "./item-search";
import { StashRow } from "./stash-row";
import { CapacityBar, EmptyState, ItemIcon, Panel, Stat, ToneBadge, ValueModeToggle } from "./ui";

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

  const summary = useMemo(() => summarizeLines(inventory), [inventory]);

  const plans = useMemo(
    () =>
      summary.stats
        .map((stats) => {
          const keep = retention.keepById[stats.item.id];
          return {
            stats,
            keepQty: keep?.qty ?? 0,
            recommendation: keep ? objectiveAdvice(stats, keep.qty) : recommend(stats),
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

  const setQty = (id: ItemId, qty: number) => {
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

  const updateGoal = (id: ItemId, qty: number) => {
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
                    Il manque {plural(used - capacity, "slot")}.
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
                            {plural(stats.slots, "slot")} ·{" "}
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
                {plans.map(({ stats, recommendation, keepQty }) => (
                  <StashRow
                    key={stats.item.id}
                    stats={stats}
                    recommendation={recommendation}
                    keepQty={keepQty}
                    mode={mode}
                    onInspect={onInspect}
                    onChangeQty={(qty) => setQty(stats.item.id, qty)}
                  />
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};
