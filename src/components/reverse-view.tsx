import { useMemo, useState } from "react";
import { itemsById, rarityLabel, typeLabel, type CatalogItem } from "../lib/catalog";
import {
  formatCredits,
  outputValue,
  planTarget,
  reverseSources,
  reverseTargets,
  type TargetPlan,
  type YieldKind,
} from "../lib/optimizer";
import { ItemIcon, Panel, RarityBadge, Stat } from "./ui";

const quickTargets = [
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
];

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
  const [targetId, setTargetId] = useState("advanced-electrical-components");
  const [kind, setKind] = useState<YieldKind>("recycle");
  const [needed, setNeeded] = useState(10);
  const [rarity, setRarity] = useState("all");
  const [sort, setSort] = useState<Sort>("place");

  const target = itemsById.get(targetId) ?? targets[0];
  if (!target) throw new Error("No recycling target available");

  const sources = reverseSources(target.id, kind);
  const plans = planTarget(target.id, kind, Math.max(1, needed));
  const filtered = plans.filter((plan) => rarity === "all" || plan.item.rarity === rarity);
  const sorted = [...filtered].sort((left, right) => {
    if (sort === "yield") {
      return right.yieldPerSlot - left.yieldPerSlot || left.slotsNeeded - right.slotsNeeded;
    }
    return left.slotsNeeded - right.slotsNeeded || right.yieldPerSlot - left.yieldPerSlot;
  });

  const bestEpic = plans.find((plan) => plan.item.rarity === "Epic");
  const bestLegendary = plans.find((plan) => plan.item.rarity === "Legendary");
  const craft = target.craftedFrom[0];
  const bestPerSlot = [...sources].sort((left, right) => right.yieldPerSlot - left.yieldPerSlot)[0];

  return (
    <div className="reverse">
      <Panel
        title="Trouver la source"
        eyebrow="J'ai besoin de…"
        actions={
          <div className="segmented">
            <button
              type="button"
              className={kind === "recycle" ? "is-active" : ""}
              onClick={() => setKind("recycle")}
            >
              Recyclage
            </button>
            <button
              type="button"
              className={kind === "salvage" ? "is-active" : ""}
              onClick={() => setKind("salvage")}
            >
              Salvage
            </button>
          </div>
        }
      >
        <div className="target-picker">
          <label>
            <span>Matériau cible</span>
            <select
              name="target-material"
              value={target.id}
              onChange={(event) => setTargetId(event.target.value)}
            >
              {targets.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} — {rarityLabel(item.rarity)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Quantité voulue</span>
            <input
              type="number"
              min={1}
              max={9999}
              name="needed-quantity"
              value={needed}
              onChange={(event) => setNeeded(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        </div>

        <div className="chips">
          {quickTargets
            .map((id) => itemsById.get(id))
            .filter((item): item is CatalogItem => Boolean(item))
            .map((item) => (
              <button
                type="button"
                key={item.id}
                className={`chip${item.id === target.id ? " is-active" : ""}`}
                onClick={() => setTargetId(item.id)}
              >
                {item.name}
              </button>
            ))}
        </div>

        <div className="target-card">
          <ItemIcon item={target} size="lg" />
          <div className="target-card__main">
            <div>
              <h3>{target.name}</h3>
              <p>
                <RarityBadge item={target} />
                {typeLabel(target.type)} · stack {target.stack} · {formatCredits(target.sell)} CR
              </p>
            </div>
            <div className="target-card__stats">
              <Stat label="Valeur" value={`${formatCredits(target.sell)} CR`} />
              <Stat
                label={kind === "recycle" ? "Recyclage" : "Salvage"}
                value={`${formatCredits(outputValue(kind === "recycle" ? target.recycle : target.salvage))} CR`}
              />
              <Stat label="Recettes" value={`${target.usedIn.length}`} />
            </div>
            {craft ? (
              <p className="craft-note">
                <strong>Alternative craft :</strong>{" "}
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
          <div className="callout">
            <span className="callout__tag">Meilleur épique</span>
            <ItemIcon item={bestEpic.item} size="sm" />
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
          <div className="callout callout--muted">
            <span className="callout__tag">Meilleur légendaire</span>
            <ItemIcon item={bestLegendary.item} size="sm" />
            <span>
              {bestLegendary.unitsNeeded}× {bestLegendary.item.name} pour{" "}
              {bestLegendary.slotsNeeded} slot
              {bestLegendary.slotsNeeded > 1 ? "s" : ""}. Rendement : {bestLegendary.yieldPerSlot}{" "}
              {target.name} / slot.
            </span>
          </div>
        ) : null}

        <div className="reverse-tools">
          <div className="chips">
            {rarityFilters.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={`chip${rarity === filter.value ? " is-active" : ""}`}
                onClick={() => setRarity(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button
              type="button"
              className={sort === "place" ? "is-active" : ""}
              onClick={() => setSort("place")}
            >
              Moins de place
            </button>
            <button
              type="button"
              className={sort === "yield" ? "is-active" : ""}
              onClick={() => setSort("yield")}
            >
              Rendement / slot
            </button>
          </div>
        </div>

        <p className="reverse-note">
          {sources.length} source{sources.length > 1 ? "s" : ""} en{" "}
          {kind === "recycle" ? "recyclage" : "salvage"}.
          {bestPerSlot ? (
            <>
              {" "}
              Meilleur rendement théorique : <strong>{bestPerSlot.item.name}</strong> (
              {bestPerSlot.yieldPerSlot} {target.name} par slot plein).
            </>
          ) : null}
        </p>

        {sorted.length === 0 ? (
          <p className="empty-inline">
            Aucune source pour ce filtre. Essaie « Tous » ou change de matériau.
          </p>
        ) : (
          <div className="source-list">
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
    </div>
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
  <article className={`source${index === 0 ? " source--best" : ""}`}>
    <div className="source__head">
      <span className={`rank${index < 3 ? " rank--top" : ""}`}>{index + 1}</span>
      <button type="button" className="line__item" onClick={() => onInspect(plan.item)}>
        <ItemIcon item={plan.item} />
        <span>
          <strong>{plan.item.name}</strong>
          <small>
            <RarityBadge item={plan.item} />
            {typeLabel(plan.item.type)} · stack {plan.item.stack}
          </small>
        </span>
      </button>
      <div className="source__yield">
        <strong>
          {plan.outputQty}× {target.name}
        </strong>
        <small>par item · {plan.yieldPerSlot} / slot plein</small>
      </div>
    </div>
    <div className="source__plan">
      <div>
        <span>Pour {needed}×</span>
        <strong>
          {plan.unitsNeeded} item{plan.unitsNeeded > 1 ? "s" : ""}
        </strong>
      </div>
      <div>
        <span>Place</span>
        <strong>
          {plan.slotsNeeded} slot{plan.slotsNeeded > 1 ? "s" : ""}
        </strong>
      </div>
      <div>
        <span>Reste</span>
        <strong>{plan.leftover}</strong>
      </div>
      <div>
        <span>Coût si vendu</span>
        <strong>{formatCredits(plan.item.sell * plan.unitsNeeded)} CR</strong>
        <small>
          {formatCredits(plan.sellPerOutput)} CR / {target.name}
        </small>
      </div>
    </div>
  </article>
);
