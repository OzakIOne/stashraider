import { BoxesIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "./components/graph-view";
import { ItemModal } from "./components/item-modal";
import { LootView } from "./components/loot-view";
import { MethodView } from "./components/method-view";
import { ReverseView } from "./components/reverse-view";
import { StashView } from "./components/stash-view";
import { Progress } from "./components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { catalog, itemByRecipeName, type CatalogItem } from "./lib/catalog";
import { DEFAULT_CAPACITY, TOAST_MS } from "./lib/constants";
import { formatCredits, statsForLines, type InventoryLine, type ValueMode } from "./lib/line-stats";
import type { Goal } from "./lib/retention";
import { decodeCapacity, decodeGoals, decodeInventory, decodeValueMode } from "./lib/storage";
import { useLocalStorage } from "./lib/use-local-storage";

type Tab = "stash" | "loot" | "reverse" | "graph" | "method";

const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: "stash", label: "Stash", hint: "Garder, vendre ou recycler chaque ligne" },
  { id: "loot", label: "Butin", hint: "Ce qu'il faut ramener quand la place manque" },
  { id: "reverse", label: "Recyclage", hint: "Le meilleur item à démonter pour un matériau" },
  { id: "graph", label: "Graphe", hint: "Tous les rendements de recyclage, item par item" },
  { id: "method", label: "Méthode", hint: "Formules, source et limites" },
];

const isTab = (value: string): value is Tab => tabs.some((entry) => entry.id === value);

const demoLines = (
  entries: { name: string; qty: number }[],
): { id: NonNullable<ReturnType<typeof itemByRecipeName>>["id"]; qty: number }[] =>
  entries.flatMap(({ name, qty }) => {
    const item = itemByRecipeName(name);
    return item ? [{ id: item.id, qty }] : [];
  });

const demoStash: InventoryLine[] = demoLines([
  { name: "Rocketeer Driver", qty: 4 },
  { name: "Advanced Electrical Components", qty: 12 },
  { name: "ARC Alloy", qty: 30 },
  { name: "Processor", qty: 6 },
  { name: "Frequency Modulation Box", qty: 2 },
  { name: "Vaporizer Regulator", qty: 1 },
  { name: "Tactical Mk. 3 Smoke", qty: 1 },
  { name: "Glitched ARC Light Ring", qty: 1 },
]);

const demoGoals: Goal[] = demoLines([{ name: "Advanced Electrical Components", qty: 10 }]);

const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });

const GithubMark = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="size-4">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

const App = () => {
  const [tab, setTab] = useState<Tab>("stash");
  const [inventory, setInventory] = useLocalStorage<InventoryLine[]>({
    key: "stashraider.inventory",
    fallback: [],
    decode: decodeInventory,
  });
  const [loot, setLoot] = useLocalStorage<InventoryLine[]>({
    key: "stashraider.loot",
    fallback: [],
    decode: decodeInventory,
  });
  const [capacity, setCapacity] = useLocalStorage<number>({
    key: "stashraider.capacity",
    fallback: DEFAULT_CAPACITY,
    decode: decodeCapacity,
  });
  const [mode, setMode] = useLocalStorage<ValueMode>({
    key: "stashraider.value-mode",
    fallback: "sell",
    decode: decodeValueMode,
  });
  const [goals, setGoals] = useLocalStorage<Goal[]>({
    key: "stashraider.goals",
    fallback: [],
    decode: decodeGoals,
  });
  const [inspected, setInspected] = useState<CatalogItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const notify = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, TOAST_MS);
  };

  const { used, totalSell, totalRecycle } = useMemo(() => {
    const stats = statsForLines(inventory);
    return {
      used: stats.reduce((total, line) => total + line.slots, 0),
      totalSell: stats.reduce((total, line) => total + line.sellValue, 0),
      totalRecycle: stats.reduce((total, line) => total + line.recycleValue, 0),
    };
  }, [inventory]);

  const addToStash = (item: CatalogItem, qty = 1) => {
    setInventory((lines) => {
      const existing = lines.find((line) => line.id === item.id);
      if (existing) {
        return lines.map((line) => (line.id === item.id ? { ...line, qty: line.qty + qty } : line));
      }
      return [...lines, { id: item.id, qty }];
    });
    notify(`${qty}× ${item.name} ajouté${qty > 1 ? "s" : ""} au stash`);
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
    <TooltipProvider>
      <div className="relative min-h-screen">
        <div className="app-backdrop" aria-hidden="true" />

        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-3 px-3 sm:px-5">
            <a
              className="flex shrink-0 items-center gap-2"
              href="#top"
              onClick={() => setTab("stash")}
            >
              <span className="grid size-8 place-items-center border border-primary/50 bg-gradient-to-br from-primary/25 to-primary/5 text-[11px] font-extrabold tracking-wider text-primary [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]">
                SR
              </span>
              <span className="hidden text-sm font-extrabold tracking-[0.08em] sm:block">
                STASH<span className="text-primary">RAIDER</span>
              </span>
            </a>

            <Tabs
              value={tab}
              onValueChange={(value) => {
                if (isTab(value)) setTab(value);
              }}
              className="min-w-0 flex-1"
            >
              <TabsList className="max-w-full self-start overflow-x-auto [scrollbar-width:none]">
                {tabs.map((entry) => (
                  <TabsTrigger key={entry.id} value={entry.id} title={entry.hint}>
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setTab("stash")}
                    className="hidden items-center gap-2 rounded-full border border-border bg-black/30 py-1 pr-2.5 pl-2 text-[11px] transition-colors hover:border-primary/40 sm:flex"
                  >
                    <BoxesIcon className="size-3.5 text-primary" />
                    <span className="font-semibold tabular-nums">
                      {used}
                      <span className="text-muted-foreground">/{capacity}</span>
                    </span>
                    <Progress
                      value={capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0}
                      className="h-1 w-10"
                      indicatorClassName={
                        used > capacity
                          ? "bg-gradient-to-r from-[#ff9a3d] to-destructive"
                          : undefined
                      }
                    />
                    <span className="text-muted-foreground tabular-nums">
                      {formatCredits(Math.max(totalSell, totalRecycle))} CR
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="grid gap-1">
                  <span className="flex justify-between gap-4">
                    Slots{" "}
                    <strong className="tabular-nums">
                      {used}/{capacity}
                    </strong>
                  </span>
                  <span className="flex justify-between gap-4">
                    Revente <strong className="tabular-nums">{formatCredits(totalSell)} CR</strong>
                  </span>
                  <span className="flex justify-between gap-4">
                    Recyclage{" "}
                    <strong className="tabular-nums">{formatCredits(totalRecycle)} CR</strong>
                  </span>
                  <span className="flex justify-between gap-4">
                    Lignes <strong className="tabular-nums">{inventory.length}</strong>
                  </span>
                </TooltipContent>
              </Tooltip>

              <a
                href="https://github.com/OzakIOne/stashraider"
                target="_blank"
                rel="noreferrer"
                aria-label="Dépôt GitHub"
                className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <GithubMark />
              </a>
            </div>
          </div>
        </header>

        <main id="top" className="mx-auto w-full max-w-[1480px] px-3 pt-3 pb-14 sm:px-5">
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
                setGoals(demoGoals);
                notify("Stash d'exemple chargé");
              }}
              goals={goals}
              setGoals={setGoals}
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

          {tab === "graph" ? <GraphView onInspect={setInspected} /> : null}

          {tab === "method" ? <MethodView /> : null}
        </main>

        <footer className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-4 text-[11px] text-muted-foreground sm:px-5">
          <span>
            Outil communautaire non officiel. Données du{" "}
            {shortDate.format(new Date(catalog.generatedAt))} · {catalog.counts.items} objets :{" "}
            <a
              href={catalog.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
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
            onAddToStash={(item, qty) => {
              addToStash(item, qty);
              setInspected(null);
            }}
          />
        ) : null}

        {toast ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed right-3 bottom-3 left-3 z-80 rounded-lg border border-success/35 bg-[#101a15] px-3.5 py-2.5 text-xs font-semibold text-[#a8f0c4] shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 sm:left-auto"
          >
            {toast}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
};

export default App;
