import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { NumberInput } from "@/components/ui/number-input";
import { itemsById, rarityLabel, typeLabel, type CatalogItem } from "@/lib/catalog";
import { toItemId, type ItemId } from "@/lib/catalog-types";
import {
  formatCredits,
  outputValue,
  planTarget,
  reverseSources,
  reverseTargets,
  type TargetPlan,
} from "@/lib/optimizer";
import { cn } from "@/lib/utils";
import { EmptyState, ItemIcon, Panel, RarityBadge, Stat } from "./ui";

const quickTargets: ItemId[] = [
  "advanced-electrical-components",
  "electrical-components",
  "arc-alloy",
  "processor",
  "mechanical-components",
  "advanced-mechanical-components",
  "wires",
  "metal-parts",
  "chemicals",
  "plastic-parts",
].map(toItemId);

const rarityFilters = [
  { label: "Tous", value: "all" },
  { label: "Épique", value: "Epic" },
  { label: "Légendaire", value: "Legendary" },
  { label: "Rare", value: "Rare" },
  { label: "Peu commun", value: "Uncommon" },
];

type Sort = "place" | "yield";

export const ReverseView = ({ onInspect }: { onInspect: (item: CatalogItem) => void }) => {
  const targets = useMemo(() => reverseTargets(), []);
  const [targetId, setTargetId] = useState<ItemId>(toItemId("advanced-electrical-components"));
  const [needed, setNeeded] = useState(10);
  const [rarity, setRarity] = useState("all");
  const [sort, setSort] = useState<Sort>("place");

  const target = itemsById.get(targetId) ?? targets[0];

  const options = useMemo<ComboboxOption[]>(
    () =>
      targets.map((item) => ({
        value: item.id,
        label: item.name,
        group: rarityLabel(item.rarity),
        keywords: [item.type, typeLabel(item.type), rarityLabel(item.rarity)],
        leading: <ItemIcon item={item} size="xs" />,
        meta: <RarityBadge item={item} />,
      })),
    [targets],
  );

  const sources = useMemo(() => (target ? reverseSources(target.id) : []), [target]);
  const plans = useMemo(
    () => (target ? planTarget(target.id, Math.max(1, needed)) : []),
    [target, needed],
  );
  const sorted = useMemo(
    () =>
      plans
        .filter((plan) => rarity === "all" || plan.item.rarity === rarity)
        .sort((left, right) => {
          if (sort === "yield") {
            return right.yieldPerSlot - left.yieldPerSlot || left.slotsNeeded - right.slotsNeeded;
          }
          return left.slotsNeeded - right.slotsNeeded || right.yieldPerSlot - left.yieldPerSlot;
        }),
    [plans, rarity, sort],
  );
  const bestPerSlot = useMemo(
    () => [...sources].sort((left, right) => right.yieldPerSlot - left.yieldPerSlot)[0],
    [sources],
  );

  if (!target) {
    return (
      <Panel title="Trouver la source" description="Aucun matériau recyclable dans le catalogue">
        <EmptyState
          title="Catalogue incomplet"
          text="Aucun rendement de recyclage n'est disponible. Relance la synchronisation des données."
        />
      </Panel>
    );
  }

  const bestEpic = plans.find((plan) => plan.item.rarity === "Epic");
  const bestLegendary = plans.find((plan) => plan.item.rarity === "Legendary");
  const craft = target.craftedFrom[0];

  return (
    <Panel
      title="Trouver la source"
      description="Quel item démonter pour un matériau donné"
      className="gap-0"
    >
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Matériau cible
          </span>
          <Combobox
            options={options}
            value={target.id}
            onChange={(next) => setTargetId(toItemId(next))}
            placeholder="Choisir un matériau…"
            searchPlaceholder="Chercher un matériau…"
            emptyText="Aucun matériau ne correspond."
            ariaLabel="Matériau cible"
            contentClassName="w-[min(22rem,calc(100vw-2rem))]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Quantité voulue
          </span>
          <NumberInput
            min={1}
            value={needed}
            onCommit={setNeeded}
            aria-label="Quantité voulue"
            className="tabular-nums"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4">
        {quickTargets
          .map((id) => itemsById.get(id))
          .filter((item): item is CatalogItem => Boolean(item))
          .map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setTargetId(item.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
                item.id === target.id
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-input hover:text-foreground",
              )}
            >
              {item.name}
            </button>
          ))}
      </div>

      <div className="mx-4 mt-3 flex flex-col gap-3 rounded-xl border border-border bg-[radial-gradient(600px_180px_at_0%_0%,rgba(177,140,255,0.08),transparent_65%)] bg-black/25 p-3 sm:flex-row">
        <ItemIcon item={target} size="lg" />
        <div className="grid flex-1 gap-2.5">
          <div>
            <h3 className="text-base font-semibold">{target.name}</h3>
            <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <RarityBadge item={target} />
              {typeLabel(target.type)} · stack {target.stack} · {formatCredits(target.sell)} CR
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Valeur" value={`${formatCredits(target.sell)} CR`} />
            <Stat label="Recyclage" value={`${formatCredits(outputValue(target.recycle))} CR`} />
            <Stat label="Recettes" value={`${target.usedIn.length}`} />
          </div>
          {craft ? (
            <p className="border-t border-border pt-2 text-[11.5px] text-muted-foreground">
              <strong className="text-muted-foreground/80">Alternative craft :</strong>{" "}
              {craft.ingredients
                .map((ingredient) => `${ingredient.qty}× ${ingredient.item}`)
                .join(" + ")}{" "}
              → {craft.resultQty}× {target.name}
              {craft.station ? ` @ ${craft.station}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {bestEpic ? (
        <div className="mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-rarity-epic/30 bg-rarity-epic/[0.07] px-3 py-2 text-xs">
          <Badge className="bg-rarity-epic/15 text-rarity-epic">Meilleur épique</Badge>
          <ItemIcon item={bestEpic.item} size="xs" />
          <span>
            Pour{" "}
            <strong>
              {needed}× {target.name}
            </strong>
            , recycle{" "}
            <strong>
              {bestEpic.unitsNeeded}× {bestEpic.item.name}
            </strong>{" "}
            → {bestEpic.unitsNeeded * bestEpic.outputQty} unités en {bestEpic.slotsNeeded} slot
            {bestEpic.slotsNeeded > 1 ? "s" : ""}
            {bestEpic.leftover > 0 ? ` (${bestEpic.leftover} en trop)` : ""}.
          </span>
        </div>
      ) : null}
      {bestLegendary && bestLegendary !== bestEpic ? (
        <div className="mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-rarity-legendary/25 bg-rarity-legendary/[0.05] px-3 py-2 text-xs">
          <Badge className="bg-rarity-legendary/12 text-rarity-legendary">
            Meilleur légendaire
          </Badge>
          <ItemIcon item={bestLegendary.item} size="xs" />
          <span>
            {bestLegendary.unitsNeeded}× {bestLegendary.item.name} pour {bestLegendary.slotsNeeded}{" "}
            slot
            {bestLegendary.slotsNeeded > 1 ? "s" : ""}. Rendement : {bestLegendary.yieldPerSlot}{" "}
            {target.name} / slot.
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {rarityFilters.map((filter) => (
            <button
              type="button"
              key={filter.value}
              onClick={() => setRarity(filter.value)}
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
        <div className="inline-flex rounded-lg border border-border bg-black/40 p-0.5">
          {(
            [
              ["place", "Moins de place"],
              ["yield", "Rendement / slot"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              className={cn(
                "rounded-[6px] px-2 py-1 text-[11px] font-semibold transition-colors",
                sort === value
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="px-4 pb-2 text-[11.5px] text-muted-foreground">
        {sources.length} source{sources.length > 1 ? "s" : ""} en recyclage.
        {bestPerSlot ? (
          <>
            {" "}
            Meilleur rendement théorique : <strong>{bestPerSlot.item.name}</strong> (
            {bestPerSlot.yieldPerSlot} {target.name} par slot plein).
          </>
        ) : null}
      </p>

      {sorted.length === 0 ? (
        <p className="mx-4 mb-4 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Aucune source pour ce filtre. Essaie « Tous » ou change de matériau.
        </p>
      ) : (
        <div className="grid gap-2 px-4 pb-4">
          {sorted.map((plan, index) => (
            <SourceCard
              key={plan.item.id}
              plan={plan}
              target={target}
              index={index}
              needed={needed}
              onInspect={onInspect}
            />
          ))}
        </div>
      )}
    </Panel>
  );
};

const SourceCard = ({
  plan,
  target,
  index,
  needed,
  onInspect,
}: {
  plan: TargetPlan;
  target: CatalogItem;
  index: number;
  needed: number;
  onInspect: (item: CatalogItem) => void;
}) => (
  <article
    className={cn(
      "overflow-hidden rounded-xl border border-border bg-black/25",
      index === 0 && "border-primary/30 bg-gradient-to-r from-primary/[0.06] to-black/20",
    )}
  >
    <div className="grid grid-cols-[26px_minmax(0,1fr)] items-center gap-2.5 px-3 py-2.5 sm:grid-cols-[26px_minmax(0,1fr)_auto] sm:gap-3">
      <span
        className={cn(
          "grid size-6 place-items-center rounded-md border border-border text-[11px] font-bold tabular-nums text-muted-foreground",
          index < 3 && "border-primary/45 bg-primary/10 text-primary",
        )}
      >
        {index + 1}
      </span>
      <button
        type="button"
        onClick={() => onInspect(plan.item)}
        className="flex min-w-0 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ItemIcon item={plan.item} />
        <span className="grid min-w-0 gap-0.5">
          <strong className="truncate text-[13px] font-semibold">{plan.item.name}</strong>
          <small className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <RarityBadge item={plan.item} />
            {typeLabel(plan.item.type)} · stack {plan.item.stack}
          </small>
        </span>
      </button>
      <div className="col-start-2 grid gap-0.5 text-left sm:col-start-auto sm:text-right">
        <strong className="text-[13px] tabular-nums text-rarity-epic">
          {plan.outputQty}× {target.name}
        </strong>
        <small className="text-[10px] text-muted-foreground">
          par item · {plan.yieldPerSlot} / slot plein
        </small>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2.5 border-t border-border bg-white/[0.02] px-3 py-2 sm:grid-cols-4">
      <div className="grid gap-px">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
          Pour {needed}×
        </span>
        <strong className="text-xs tabular-nums">
          {plan.unitsNeeded} item{plan.unitsNeeded > 1 ? "s" : ""}
        </strong>
      </div>
      <div className="grid gap-px">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">Place</span>
        <strong className="text-xs tabular-nums">
          {plan.slotsNeeded} slot{plan.slotsNeeded > 1 ? "s" : ""}
        </strong>
      </div>
      <div className="grid gap-px">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">Reste</span>
        <strong className="text-xs tabular-nums">{plan.leftover}</strong>
      </div>
      <div className="grid gap-px">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
          Coût si vendu
        </span>
        <strong className="text-xs tabular-nums">
          {formatCredits(plan.item.sell * plan.unitsNeeded)} CR
        </strong>
        <small className="text-[9px] text-muted-foreground">
          {formatCredits(plan.sellPerOutput)} CR / {target.name}
        </small>
      </div>
    </div>
  </article>
);
