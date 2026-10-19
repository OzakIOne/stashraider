import { useDeferredValue, useMemo, useState } from "react";
import { searchItems, type CatalogItem } from "../lib/catalog";
import { formatCredits } from "../lib/optimizer";
import { ItemIcon, RarityBadge } from "./ui";

const rarities = ["Tous", "Rare", "Épique", "Légendaire", "Peu commun", "Commun"];
const rarityByName: Record<string, string> = {
  Rare: "Rare",
  Épique: "Epic",
  Légendaire: "Legendary",
  "Peu commun": "Uncommon",
  Commun: "Common",
};

export const ItemSearch = ({
  onPick,
  onPickStack,
  exclude = new Set<string>(),
}: {
  onPick: (item: CatalogItem) => void;
  onPickStack: (item: CatalogItem) => void;
  exclude?: Set<string>;
}) => {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("Tous");
  const [includeHidden, setIncludeHidden] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const matches = searchItems(deferredQuery, includeHidden).filter((item) => {
      if (rarity !== "Tous" && item.rarity !== rarityByName[rarity]) return false;
      return true;
    });
    return matches.slice(0, 60);
  }, [deferredQuery, includeHidden, rarity]);

  return (
    <div className="search">
      <div className="search__input">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          name="item-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher un item, un type…"
          aria-label="Chercher un item"
        />
        <kbd>563</kbd>
      </div>
      <div className="chips">
        {rarities.map((label) => (
          <button
            key={label}
            type="button"
            className={`chip${rarity === label ? " is-active" : ""}`}
            onClick={() => setRarity(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          name="include-hidden"
          checked={includeHidden}
          onChange={(event) => setIncludeHidden(event.target.checked)}
        />
        Inclure plans, clés et objets de quête
      </label>
      <div className="search__results">
        {results.length === 0 ? (
          <p className="search__empty">Aucun item trouvé. Essaie un autre nom.</p>
        ) : (
          results.map((item) => {
            const alreadyAdded = exclude.has(item.id);
            return (
              <div key={item.id} className={`search-result${alreadyAdded ? " is-added" : ""}`}>
                <button type="button" className="search-result__main" onClick={() => onPick(item)}>
                  <ItemIcon item={item} size="sm" />
                  <span className="search-result__body">
                    <span className="search-result__name">{item.name}</span>
                    <span className="search-result__meta">
                      <RarityBadge item={item} />
                      <span>{item.stack} / stack</span>
                      {item.sell > 0 ? <span>{formatCredits(item.sell)} CR</span> : null}
                    </span>
                  </span>
                  <span className="search-result__add">{alreadyAdded ? "✓" : "+"}</span>
                </button>
                {item.stack > 1 ? (
                  <button
                    type="button"
                    className="search-result__stack"
                    onClick={() => onPickStack(item)}
                    title={`Ajouter un stack complet (${item.stack})`}
                    aria-label={`Ajouter un stack complet de ${item.name} (${item.stack})`}
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
