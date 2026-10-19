import { useEffect } from "react";
import { itemsByName, rarityLabel, typeLabel, type CatalogItem } from "../lib/catalog";
import { formatCredits, outputValue } from "../lib/optimizer";
import { ItemIcon } from "./ui";

const YieldList = ({ item }: { item: CatalogItem }) => {
  const entries = Object.entries(item.recycle).sort(([, left], [, right]) => right - left);
  if (entries.length === 0) {
    return <p className="muted">Aucun rendement connu.</p>;
  }
  return (
    <div className="yield-list">
      {entries.map(([name, qty]) => {
        const output = itemsByName.get(name);
        return (
          <div className="yield" key={name}>
            {output ? <ItemIcon item={output} size="sm" /> : null}
            <span>
              <strong>
                {qty}× {name}
              </strong>
              <small>{output ? `${formatCredits(output.sell * qty)} CR` : "valeur inconnue"}</small>
            </span>
          </div>
        );
      })}
      <div className="yield__total">
        Total matière <strong>{formatCredits(outputValue(item.recycle))} CR</strong>
      </div>
    </div>
  );
};

export const ItemModal = ({
  item,
  onClose,
  onAddToStash,
}: {
  item: CatalogItem;
  onClose: () => void;
  onAddToStash: (item: CatalogItem, qty: number) => void;
}) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className="modal__card"
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal__close" onClick={onClose} aria-label="Fermer">
          ×
        </button>
        <header className="modal__head">
          <ItemIcon item={item} size="xl" />
          <div>
            <p className="eyebrow">
              {typeLabel(item.type)} · {rarityLabel(item.rarity)}
            </p>
            <h2>{item.name}</h2>
            <div className="modal__badges">
              <span>{item.stack} par stack</span>
              <span>{item.weight} kg</span>
              <span>{formatCredits(item.sell)} CR</span>
            </div>
          </div>
        </header>

        <div className="modal__stats">
          <div>
            <span>Valeur stack plein</span>
            <strong>{formatCredits(item.sell * item.stack)} CR</strong>
          </div>
          <div>
            <span>Recyclage</span>
            <strong>{formatCredits(outputValue(item.recycle))} CR</strong>
          </div>
          <div>
            <span>Recettes</span>
            <strong>{item.usedIn.length}</strong>
          </div>
        </div>

        <section className="modal__section">
          <h3>Recyclage</h3>
          <YieldList item={item} />
        </section>

        {item.craftedFrom.length > 0 ? (
          <section className="modal__section">
            <h3>Craft</h3>
            {item.craftedFrom.map((recipe) => (
              <div
                className="recipe"
                key={`${recipe.station}-${JSON.stringify(recipe.ingredients)}`}
              >
                <span className="recipe__station">{recipe.station || "Inventaire"}</span>
                <span>
                  {recipe.ingredients
                    .map((ingredient) => `${ingredient.qty}× ${ingredient.item}`)
                    .join(" + ")}
                </span>
                <strong>
                  → {recipe.resultQty}× {item.name}
                </strong>
              </div>
            ))}
          </section>
        ) : null}

        {item.usedIn.length > 0 ? (
          <section className="modal__section">
            <h3>Utilisé pour craft</h3>
            <div className="use-list">
              {item.usedIn.slice(0, 10).map((use) => (
                <span key={`${use.result}-${use.station}-${use.qty}`}>
                  {use.qty}× {use.result}
                  {use.station ? <small>{use.station}</small> : null}
                </span>
              ))}
            </div>
            {item.usedIn.length > 10 ? (
              <p className="muted">+{item.usedIn.length - 10} autres recettes</p>
            ) : null}
          </section>
        ) : null}

        {item.locations.length > 0 ? (
          <section className="modal__section">
            <h3>Zones</h3>
            <div className="chips">
              {item.locations.map((location) => (
                <span className="chip" key={location}>
                  {location}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="modal__foot">
          <div className="modal__actions">
            {item.stack > 1 ? (
              <>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => onAddToStash(item, 1)}
                >
                  Ajouter 1
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => onAddToStash(item, item.stack)}
                >
                  Ajouter un stack ({item.stack})
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button button--primary"
                onClick={() => onAddToStash(item, 1)}
              >
                Ajouter au stash
              </button>
            )}
          </div>
          <span className="muted">La fiche ne remplace pas l'écran de recyclage du jeu.</span>
        </footer>
      </div>
    </div>
  );
};
