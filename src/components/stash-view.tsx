import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { catalog, hiddenFromLoot, typeLabel, type CatalogItem } from "../lib/catalog";
import {
  bestValue,
  capacityAdvice,
  formatCredits,
  planRetention,
  recommend,
  retentionRecommendation,
  statsForLines,
  totalSlots,
  totalValue,
  type Goal,
  type InventoryLine,
  type ValueMode,
} from "../lib/optimizer";
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
  ValueModeToggle,
} from "./ui";

type SortMode = "density" | "name" | "slots";

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

  const plans = useMemo(
    () =>
      statsForLines(inventory)
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
    [inventory, sort, retention],
  );

  const used = totalSlots(inventory);
  const sellTotal = totalValue(inventory, "sell");
  const recycleTotal = totalValue(inventory, "recycle");
  const averageDensity = used > 0 ? Math.max(sellTotal, recycleTotal) / used : 0;
  const advice = capacityAdvice(inventory, capacity, mode);
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
    <div className="workspace">
      <Panel title="Ajouter du butin" eyebrow="Base de données" className="workspace__side">
        <InventoryImport onImport={importInventory} />
        <ItemSearch
          onPick={addItem}
          onPickStack={(item) => addItem(item, item.stack)}
          exclude={new Set(inventory.map((line) => line.id))}
        />
      </Panel>

      <div className="workspace__main">
        <Panel
          title="Mon stash"
          eyebrow="Simulateur de place"
          actions={
            <div className="head-tools">
              <label className="capacity-input">
                <span>Capacité</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  name="stash-capacity"
                  value={capacity}
                  onChange={(event) => setCapacity(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
              <ValueModeToggle mode={mode} onChange={setMode} />
            </div>
          }
        >
          <CapacityBar used={used} capacity={capacity} />

          <GoalsPanel
            goals={goals}
            plan={retention}
            targets={targets}
            onAdd={addGoal}
            onUpdate={updateGoal}
            onRemove={(id) => updateGoal(id, 0)}
          />

          <div className="stats">
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
            <div className="objective-summary">
              <span>
                <strong>
                  {retention.coveredGoals}/{goals.length}
                </strong>{" "}
                objectifs couverts
              </span>
              <span>
                <strong>{retention.reservedLines}</strong> lignes réservées
              </span>
              <span>
                <strong>{retention.surplusUnits}</strong> unités hors objectifs
              </span>
              <span>
                <strong>{formatCredits(retention.surplusValue)} CR</strong> de valeur brute
              </span>
            </div>
          ) : null}

          {plans.length === 0 ? (
            <EmptyState
              title="Ton stash est vide"
              text="Cherche un item à gauche et ajoute-le pour voir combien de slots il coûte, ce qu'il rapporte et s'il vaut mieux le garder, le vendre ou le recycler."
              action={
                <button type="button" className="button button--ghost" onClick={onLoadDemo}>
                  Charger un stash d'exemple
                </button>
              }
            />
          ) : (
            <>
              <div className="plan-bar">
                <span className="plan plan--recycle">{counts.recycle} à recycler</span>
                <span className="plan plan--sell">{counts.sell} à vendre</span>
                <span className="plan plan--keep">{counts.keep} à garder</span>
                <label className="sort">
                  Trier
                  <select
                    name="stash-sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortMode)}
                  >
                    <option value="density">Valeur / slot</option>
                    <option value="slots">Slots</option>
                    <option value="name">Nom</option>
                  </select>
                </label>
                <button type="button" className="link-button" onClick={() => setInventory([])}>
                  Vider
                </button>
              </div>

              {used > capacity ? (
                <div className="alert alert--danger">
                  <strong>
                    Il manque {used - capacity} slot{used - capacity > 1 ? "s" : ""}.
                  </strong>
                  <span>Les lignes les moins rentables à sortir en premier :</span>
                  <div className="alert__items">
                    {advice.map((stats) => (
                      <button
                        type="button"
                        key={stats.item.id}
                        className="alert__item"
                        onClick={() => setQty(stats.item.id, 0)}
                      >
                        <ItemIcon item={stats.item} size="sm" />
                        <span>
                          {stats.item.name}
                          <small>
                            {stats.slots} slot{stats.slots > 1 ? "s" : ""} ·{" "}
                            {formatCredits(bestValue(stats, mode) / Math.max(1, stats.slots))}{" "}
                            CR/slot
                          </small>
                        </span>
                        <span className="alert__remove">Retirer</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="line-table">
                <div className="line-table__head">
                  <span>Item</span>
                  <span>Qté</span>
                  <span>Slots</span>
                  <span>Valeur</span>
                  <span>Verdict</span>
                </div>
                {plans.map(({ stats, recommendation, keepQty }) => {
                  const lineValue = bestValue(stats, mode);
                  return (
                    <div className="line" key={stats.item.id}>
                      <button
                        type="button"
                        className="line__item"
                        onClick={() => onInspect(stats.item)}
                      >
                        <ItemIcon item={stats.item} />
                        <span>
                          <strong>{stats.item.name}</strong>
                          <small>
                            <RarityBadge item={stats.item} />
                            {typeLabel(stats.item.type)} · stack {stats.item.stack}
                            {keepQty > 0 ? <span className="goal-tag">Objectif</span> : null}
                          </small>
                        </span>
                      </button>
                      <div className="line__qty">
                        <QtyStepper
                          qty={stats.qty}
                          onChange={(qty) => setQty(stats.item.id, qty)}
                          compact
                        />
                        {stats.item.stack > 1 ? (
                          <button
                            type="button"
                            className="stack-add"
                            onClick={() => setQty(stats.item.id, stats.qty + stats.item.stack)}
                            title={`Ajouter un stack complet (${stats.item.stack})`}
                            aria-label={`Ajouter un stack complet de ${stats.item.name} (${stats.item.stack})`}
                          >
                            +{stats.item.stack}
                          </button>
                        ) : null}
                      </div>
                      <div className="metric metric--slots">
                        <strong>{stats.slots}</strong>
                        <small>slot{stats.slots > 1 ? "s" : ""}</small>
                      </div>
                      <div className="metric metric--value">
                        <strong>{formatCredits(lineValue)} CR</strong>
                        <small>{formatCredits(lineValue / Math.max(1, stats.slots))} / slot</small>
                        <small className="mobile-slot">
                          {stats.slots} slot{stats.slots > 1 ? "s" : ""}
                        </small>
                      </div>
                      <div className={`verdict verdict--${recommendation.kind}`}>
                        <span>{recommendation.label}</span>
                        <small>{recommendation.detail}</small>
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
