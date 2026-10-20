import { SearchIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { catalog, rarityLabels, searchItems, type CatalogItem } from "@/lib/catalog";
import type { ItemId, Rarity } from "@/lib/catalog-types";
import { SEARCH_RESULT_LIMIT } from "@/lib/constants";
import { formatCredits } from "@/lib/line-stats";
import { cn } from "@/lib/utils";
import { ItemIcon, RarityBadge } from "./ui";

type RarityFilter = "all" | Rarity;

const rarityFilters: { value: RarityFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "Rare", label: rarityLabels.Rare },
  { value: "Epic", label: rarityLabels.Epic },
  { value: "Legendary", label: rarityLabels.Legendary },
  { value: "Uncommon", label: rarityLabels.Uncommon },
  { value: "Common", label: rarityLabels.Common },
];

export const ItemSearch = ({
  onPick,
  onPickStack,
  exclude = new Set<ItemId>(),
}: {
  onPick: (item: CatalogItem) => void;
  onPickStack: (item: CatalogItem) => void;
  exclude?: ReadonlySet<ItemId>;
}) => {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [includeHidden, setIncludeHidden] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () =>
      searchItems(deferredQuery, includeHidden)
        .filter((item) => rarity === "all" || item.rarity === rarity)
        .slice(0, SEARCH_RESULT_LIMIT),
    [deferredQuery, includeHidden, rarity],
  );

  return (
    <div className="grid gap-2.5 p-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-primary" />
        <Input
          type="search"
          name="item-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher un item, un type…"
          aria-label="Chercher un item"
          className="h-8 pr-12 pl-8 text-xs"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1 text-[9px] text-muted-foreground">
          {catalog.counts.items}
        </kbd>
      </div>

      <div className="flex flex-wrap gap-1">
        {rarityFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setRarity(filter.value)}
            aria-pressed={rarity === filter.value}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
              rarity === filter.value
                ? "border-primary/45 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <input
          type="checkbox"
          name="include-hidden"
          checked={includeHidden}
          onChange={(event) => setIncludeHidden(event.target.checked)}
          className="size-3 accent-primary"
        />
        Inclure plans, clés et objets de quête
      </label>

      <div className="grid max-h-[45vh] gap-0.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-21rem)]">
        {results.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Aucun item trouvé. Essaie un autre nom.
          </p>
        ) : (
          results.map((item) => {
            const alreadyAdded = exclude.has(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-1 rounded-lg border border-transparent px-1 transition-colors hover:border-border hover:bg-white/[0.04]",
                  alreadyAdded && "opacity-55",
                )}
              >
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <ItemIcon item={item} size="sm" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-xs font-medium">{item.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[9.5px] text-muted-foreground">
                      <RarityBadge item={item} />
                      <span>{item.stack} / stack</span>
                      {item.sell > 0 ? <span>{formatCredits(item.sell)} CR</span> : null}
                    </span>
                  </span>
                  <span className="grid size-5 shrink-0 place-items-center rounded border border-border text-xs text-muted-foreground">
                    {alreadyAdded ? "✓" : "+"}
                  </span>
                </button>
                {item.stack > 1 ? (
                  <button
                    type="button"
                    onClick={() => onPickStack(item)}
                    title={`Ajouter un stack complet (${item.stack})`}
                    aria-label={`Ajouter un stack complet de ${item.name} (${item.stack})`}
                    className="mr-1 shrink-0 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    +{item.stack}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
