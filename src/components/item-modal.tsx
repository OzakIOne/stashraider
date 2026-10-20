import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { itemsByName, rarityLabel, typeLabel, type CatalogItem } from "@/lib/catalog";
import { formatCredits, outputValue } from "@/lib/optimizer";
import { ItemIcon } from "./ui";

const YieldList = ({ item }: { item: CatalogItem }) => {
  const entries = Object.entries(item.recycle).sort(([, left], [, right]) => right - left);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">Aucun rendement connu.</p>;
  }
  return (
    <div className="grid gap-1.5">
      {entries.map(([name, qty]) => {
        const output = itemsByName.get(name);
        return (
          <div className="flex items-center gap-2" key={name}>
            {output ? <ItemIcon item={output} size="sm" /> : null}
            <span className="grid gap-px">
              <strong className="text-xs">
                {qty}× {name}
              </strong>
              <small className="text-[10px] text-muted-foreground">
                {output ? `${formatCredits(output.sell * qty)} CR` : "valeur inconnue"}
              </small>
            </span>
          </div>
        );
      })}
      <div className="flex justify-between border-t border-border pt-1.5 text-[11px] text-muted-foreground">
        Total matière{" "}
        <strong className="text-primary">{formatCredits(outputValue(item.recycle))} CR</strong>
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
}) => (
  <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
    <DialogContent aria-labelledby="item-modal-title">
      <header className="flex items-center gap-4 border-b border-border bg-[radial-gradient(500px_200px_at_0%_0%,rgba(246,167,35,0.09),transparent_65%)] p-5 pr-12">
        <ItemIcon item={item} size="xl" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">
            {typeLabel(item.type)} · {rarityLabel(item.rarity)}
          </p>
          <DialogTitle id="item-modal-title" className="mt-0.5 truncate text-xl">
            {item.name}
          </DialogTitle>
          <DialogDescription className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded border border-border px-1.5 py-px">
              {item.stack} par stack
            </span>
            <span className="rounded border border-border px-1.5 py-px">{item.weight} kg</span>
            <span className="rounded border border-border px-1.5 py-px">
              {formatCredits(item.sell)} CR
            </span>
          </DialogDescription>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 px-5 py-3">
        <div className="grid gap-0.5 rounded-lg border border-border bg-black/30 p-2.5">
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
            Valeur stack plein
          </span>
          <strong className="text-sm tabular-nums">
            {formatCredits(item.sell * item.stack)} CR
          </strong>
        </div>
        <div className="grid gap-0.5 rounded-lg border border-border bg-black/30 p-2.5">
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
            Recyclage
          </span>
          <strong className="text-sm tabular-nums">
            {formatCredits(outputValue(item.recycle))} CR
          </strong>
        </div>
        <div className="grid gap-0.5 rounded-lg border border-border bg-black/30 p-2.5">
          <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
            Recettes
          </span>
          <strong className="text-sm tabular-nums">{item.usedIn.length}</strong>
        </div>
      </div>

      <section className="px-5 pb-3">
        <h3 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Recyclage
        </h3>
        <YieldList item={item} />
      </section>

      {item.craftedFrom.length > 0 ? (
        <section className="px-5 pb-3">
          <h3 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Craft
          </h3>
          {item.craftedFrom.map((recipe) => (
            <div
              className="grid gap-0.5 rounded-lg border border-border bg-black/25 px-2.5 py-2 text-[11.5px] not-last:mb-1.5"
              key={`${recipe.station}-${JSON.stringify(recipe.ingredients)}`}
            >
              <span className="text-[9px] font-bold tracking-wider text-primary uppercase">
                {recipe.station || "Inventaire"}
              </span>
              <span>
                {recipe.ingredients
                  .map((ingredient) => `${ingredient.qty}× ${ingredient.item}`)
                  .join(" + ")}
              </span>
              <strong className="font-medium text-muted-foreground">
                → {recipe.resultQty}× {item.name}
              </strong>
            </div>
          ))}
        </section>
      ) : null}

      {item.usedIn.length > 0 ? (
        <section className="px-5 pb-3">
          <h3 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Utilisé pour craft
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {item.usedIn.slice(0, 10).map((use) => (
              <span
                key={`${use.result}-${use.station}-${use.qty}`}
                className="flex items-baseline gap-1 rounded border border-border px-1.5 py-0.5 text-[10.5px]"
              >
                {use.qty}× {use.result}
                {use.station ? (
                  <small className="text-[9px] text-muted-foreground">{use.station}</small>
                ) : null}
              </span>
            ))}
          </div>
          {item.usedIn.length > 10 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              +{item.usedIn.length - 10} autres recettes
            </p>
          ) : null}
        </section>
      ) : null}

      {item.locations.length > 0 ? (
        <section className="px-5 pb-3">
          <h3 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Zones
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {item.locations.map((location) => (
              <span
                key={location}
                className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-muted-foreground"
              >
                {location}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {item.stack > 1 ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onAddToStash(item, 1)}>
                Ajouter 1
              </Button>
              <Button size="sm" onClick={() => onAddToStash(item, item.stack)}>
                Ajouter un stack ({item.stack})
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onAddToStash(item, 1)}>
              Ajouter au stash
            </Button>
          )}
        </div>
        <span className="text-[10.5px] text-muted-foreground">
          La fiche ne remplace pas l'écran de recyclage du jeu.
        </span>
      </footer>
    </DialogContent>
  </Dialog>
);
