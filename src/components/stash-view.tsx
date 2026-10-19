import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { typeLabel, type CatalogItem } from "../lib/catalog";
import {
  bestValue,
  capacityAdvice,
  formatCredits,
  recommend,
  statsForLines,
  totalSlots,
  totalValue,
  type InventoryLine,
  type ValueMode,
} from "../lib/optimizer";
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
}: {
  inventory: InventoryLine[];
  setInventory: Dispatch<SetStateAction<InventoryLine[]>>;
  capacity: number;
  setCapacity: (capacity: number) => void;
  mode: ValueMode;
  setMode: (mode: ValueMode) => void;
  onInspect: (item: CatalogItem) => void;
  onLoadDemo: () => void;
}) => {
  const [sort, setSort] = useState<SortMode>("density");

  const plans = useMemo(
    () =>
      statsForLines(inventory)
        .map((stats) => ({ stats, recommendation: recommend(stats) }))
        .sort((left, right) => {
          if (sort === "name")
            return left.stats.item.name.localeCompare(right.stats.item.name, "fr");
          if (sort === "slots") return right.stats.slots - left.stats.slots;
          return right.stats.density - left.stats.density;
        }),
    [inventory, sort],
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
    { recycle: 0, salvage: 0, sell: 0, keep: 0 },
  );

  const addItem = (item: CatalogItem) => {
    setInventory((lines) => {
      const existing = lines.find((line) => line.id === item.id);
      if (existing) {
        return lines.map((line) => (line.id === item.id ? { ...line, qty: line.qty + 1 } : line));
      }
      return [...lines, { id: item.id, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setInventory((lines) =>
      qty <= 0
        ? lines.filter((line) => line.id !== id)
        : lines.map((line) => (line.id === id ? { ...line, qty } : line)),
    );
  };

  return (
    <div className="workspace">
      <Panel title="Ajouter du butin" eyebrow="Base de données" className="workspace__side">
        <ItemSearch onPick={addItem} exclude={new Set(inventory.map((line) => line.id))} />
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
                <span className="plan plan--recycle">
                  {counts.recycle + counts.salvage} à recycler
                </span>
                <span className="plan plan--sell">{counts.sell} à vendre</span>
                <span className="plan plan--keep">{counts.keep} à garder</span>
                <label className="sort">
                  Trier
                  <select
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
                {plans.map(({ stats, recommendation }) => {
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
                          </small>
                        </span>
                      </button>
                      <QtyStepper
                        qty={stats.qty}
                        onChange={(qty) => setQty(stats.item.id, qty)}
                        compact
                      />
                      <div className="metric">
                        <strong>{stats.slots}</strong>
                        <small>slot{stats.slots > 1 ? "s" : ""}</small>
                      </div>
                      <div className="metric">
                        <strong>{formatCredits(lineValue)} CR</strong>
                        <small>{formatCredits(lineValue / Math.max(1, stats.slots))} / slot</small>
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
