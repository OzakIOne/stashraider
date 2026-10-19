import { useEffect, useMemo, useState } from "react";
import { MethodView } from "./components/method-view";
import { ItemModal } from "./components/item-modal";
import { LootView } from "./components/loot-view";
import { ReverseView } from "./components/reverse-view";
import { StashView } from "./components/stash-view";
import { catalog, type CatalogItem } from "./lib/catalog";
import {
  formatCredits,
  statsForLines,
  totalSlots,
  type InventoryLine,
  type ValueMode,
} from "./lib/optimizer";
import { useLocalStorage } from "./lib/use-local-storage";

type Tab = "stash" | "loot" | "reverse" | "method";

const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: "stash", label: "Mon stash", hint: "Garder, vendre ou recycler chaque ligne" },
  { id: "loot", label: "Butin de raid", hint: "Ce qu'il faut ramener quand la place manque" },
  {
    id: "reverse",
    label: "Recyclage inversé",
    hint: "Le meilleur item à démonter pour un matériau",
  },
  { id: "method", label: "Méthode", hint: "Formules, source et limites" },
];

const demoStash: InventoryLine[] = [
  { id: "rocketeer-driver", qty: 4 },
  { id: "advanced-electrical-components", qty: 12 },
  { id: "arc-alloy", qty: 30 },
  { id: "processor", qty: 6 },
  { id: "frequency-modulation-box", qty: 2 },
  { id: "vaporizer-regulator", qty: 1 },
  { id: "tactical-mk-3-smoke", qty: 1 },
  { id: "glitched-arc-light-ring", qty: 1 },
];

const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

const App = () => {
  const [tab, setTab] = useState<Tab>("stash");
  const [inventory, setInventory] = useLocalStorage<InventoryLine[]>("stashraider.inventory", []);
  const [loot, setLoot] = useLocalStorage<InventoryLine[]>("stashraider.loot", []);
  const [capacity, setCapacity] = useLocalStorage<number>("stashraider.capacity", 280);
  const [mode, setMode] = useLocalStorage<ValueMode>("stashraider.value-mode", "sell");
  const [inspected, setInspected] = useState<CatalogItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const activeTab = tabs.find((entry) => entry.id === tab) ?? {
    id: tab,
    label: "StashRaider",
    hint: "Optimiseur de stash Arc Raiders",
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const used = totalSlots(inventory);
  const totalSell = useMemo(
    () => statsForLines(inventory).reduce((total, stats) => total + stats.sellValue, 0),
    [inventory],
  );
  const totalRecycle = useMemo(
    () => statsForLines(inventory).reduce((total, stats) => total + stats.recycleValue, 0),
    [inventory],
  );

  const addToStash = (item: CatalogItem) => {
    setInventory((lines) => {
      const existing = lines.find((line) => line.id === item.id);
      if (existing) {
        return lines.map((line) => (line.id === item.id ? { ...line, qty: line.qty + 1 } : line));
      }
      return [...lines, { id: item.id, qty: 1 }];
    });
    notify(`${item.name} ajouté au stash`);
  };

  const mergeIntoStash = (lines: InventoryLine[]) => {
    setInventory((current) => {
      const merged = new Map(current.map((line) => [line.id, line.qty]));
      for (const line of lines) {
        merged.set(line.id, (merged.get(line.id) ?? 0) + line.qty);
      }
      return [...merged].map(([id, qty]) => ({ id, qty }));
    });
    setTab("stash");
    notify(
      `${lines.length} ligne${lines.length > 1 ? "s" : ""} transférée${lines.length > 1 ? "s" : ""} au stash`,
    );
  };

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#top" onClick={() => setTab("stash")}>
          <span className="brand__mark">SR</span>
          <span className="brand__text">
            <strong>
              STASH<span>RAIDER</span>
            </strong>
            <small>Optimiseur Arc Raiders</small>
          </span>
        </a>
        <nav className="tabs" aria-label="Navigation principale">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={tab === entry.id ? "is-active" : ""}
              onClick={() => setTab(entry.id)}
              title={entry.hint}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <a
          className="gh-link"
          href="https://github.com/OzakIOne/stashraider"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="top">
        {tab === "stash" ? (
          <section className="hero">
            <div className="hero__copy">
              <p className="eyebrow">Arc Raiders · stash optimizer</p>
              <h1>
                Chaque slot <em>compte.</em>
              </h1>
              <p>
                Sélectionne ce que tu as, ce que tu hésites à ramener, ou le matériau qu'il te
                manque. Le site croise stacks, prix et rendements de recyclage pour dire quoi
                garder, vendre ou démonter.
              </p>
              <div className="hero__meta">
                <span className="dot" />
                Données wiki du {shortDate.format(new Date(catalog.generatedAt))} ·{" "}
                {catalog.counts.items} objets · {catalog.counts.recycling} rendements
              </div>
            </div>
            <div className="hero__board">
              <div className="hero__board-head">
                <span>Ton stash</span>
                <span className={used > capacity ? "danger" : "muted"}>
                  {used} / {capacity} slots
                </span>
              </div>
              <div className="hero__gauge">
                <div
                  className={`hero__gauge-fill${used > capacity ? " is-over" : ""}`}
                  style={{ width: `${Math.min(100, capacity > 0 ? (used / capacity) * 100 : 0)}%` }}
                />
              </div>
              <div className="hero__board-stats">
                <div>
                  <span>Revente</span>
                  <strong>{formatCredits(totalSell)} CR</strong>
                </div>
                <div>
                  <span>Recyclage</span>
                  <strong>{formatCredits(totalRecycle)} CR</strong>
                </div>
                <div>
                  <span>Lignes</span>
                  <strong>{inventory.length}</strong>
                </div>
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setTab("stash")}
              >
                Ouvrir le simulateur <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="tab-head">
            <p className="eyebrow">Outil Arc Raiders</p>
            <h1>{activeTab.label}</h1>
            <p>{activeTab.hint}.</p>
          </section>
        )}

        {tab === "stash" ? (
          <StashView
            inventory={inventory}
            setInventory={setInventory}
            capacity={capacity}
            setCapacity={setCapacity}
            mode={mode}
            setMode={setMode}
            onInspect={setInspected}
            onLoadDemo={() => {
              setInventory(demoStash);
              notify("Stash d’exemple chargé");
            }}
          />
        ) : null}

        {tab === "loot" ? (
          <LootView
            inventory={inventory}
            loot={loot}
            setLoot={setLoot}
            capacity={capacity}
            mode={mode}
            setMode={setMode}
            onInspect={setInspected}
            onSendToStash={mergeIntoStash}
          />
        ) : null}

        {tab === "reverse" ? <ReverseView onInspect={setInspected} /> : null}

        {tab === "method" ? <MethodView /> : null}
      </main>

      <footer className="site-footer">
        <span>
          Outil communautaire non officiel. Données :{" "}
          <a href={catalog.sourceUrl} target="_blank" rel="noreferrer">
            {catalog.source}
          </a>
          . Arc Raiders est une marque d'Embark Studios.
        </span>
        <span>Pas de compte, pas de serveur : ton stash reste dans ce navigateur.</span>
      </footer>

      {inspected ? (
        <ItemModal
          item={inspected}
          onClose={() => setInspected(null)}
          onAddToStash={(item) => {
            addToStash(item);
            setInspected(null);
          }}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
};

export default App;
