import { useMemo, type Dispatch, type SetStateAction } from "react";
import { typeLabel, type CatalogItem } from "../lib/catalog";
import {
  bestValue,
  formatCredits,
  statsForLines,
  totalSlots,
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

  const addItem = (item: CatalogItem) => {
    setLoot((lines) => {
      const existing = lines.find((line) => line.id === item.id);
      if (existing) {
        return lines.map((line) => (line.id === item.id ? { ...line, qty: line.qty + 1 } : line));
      }
      return [...lines, { id: item.id, qty: 1 }];
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
    <div className="workspace">
      <Panel
        title="Butin candidat"
        eyebrow="Ce que tu hésites à ramener"
        className="workspace__side"
      >
        <ItemSearch onPick={addItem} exclude={new Set(loot.map((line) => line.id))} />
      </Panel>

      <div className="workspace__main">
        <Panel
          title="Optimiseur de raid"
          eyebrow={`${freeSlots} slot${freeSlots > 1 ? "s" : ""} libre${freeSlots > 1 ? "s" : ""} dans le stash`}
          actions={<ValueModeToggle mode={mode} onChange={setMode} />}
        >
          <CapacityBar used={stashSlots} capacity={capacity} />

          <div className="stats stats--three">
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
              <div className="plan-bar">
                <span className="plan plan--keep">{retained.length} à prendre</span>
                <span className="plan plan--sell">{ranked.length - retained.length} à laisser</span>
                <span className="muted">
                  Classement par {mode === "sell" ? "revente" : "recyclage"} / slot
                </span>
                <button type="button" className="link-button" onClick={() => setLoot([])}>
                  Vider
                </button>
              </div>

              {freeSlots === 0 && ranked.length > 0 ? (
                <div className="alert alert--danger">
                  <strong>Stash plein.</strong>
                  <span>
                    Libère de la place dans l'onglet Stash, ou remplace une ligne par un item plus
                    rentable.
                  </span>
                </div>
              ) : null}

              <div className="loot-list">
                {ranked.map(({ stats, take, rank }) => {
                  const value = bestValue(stats, mode);
                  return (
                    <div className={`loot-row${take ? " is-kept" : ""}`} key={stats.item.id}>
                      <span className={`rank${rank <= 3 ? " rank--top" : ""}`}>{rank}</span>
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
                        <strong>{formatCredits(value)} CR</strong>
                        <small>{formatCredits(value / Math.max(1, stats.slots))} / slot</small>
                      </div>
                      <div className={`take${take ? " take--yes" : " take--no"}`}>
                        {take ? "Prendre" : "Laisser"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {retained.length > 0 ? (
                <div className="loot-transfer">
                  <div>
                    <strong>{formatCredits(retainedValue)} CR</strong>
                    <span>
                      dans {retainedSlots} slot{retainedSlots > 1 ? "s" : ""}, il restera{" "}
                      {Math.max(0, freeSlots - retainedSlots)} slot
                      {freeSlots - retainedSlots > 1 ? "s" : ""} libre
                      {freeSlots - retainedSlots > 1 ? "s" : ""}.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button--primary"
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
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};
