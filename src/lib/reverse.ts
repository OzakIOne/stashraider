import { catalog, itemByRecipeName, itemsById, type CatalogItem } from "./catalog";
import type { ItemId } from "./catalog-types";
import { slotsFor } from "./line-stats";

export type SourceOption = {
  item: CatalogItem;
  outputQty: number;
  yieldPerSlot: number;
  sellPerOutput: number;
};

export type TargetPlan = SourceOption & {
  unitsNeeded: number;
  slotsNeeded: number;
  leftover: number;
};

export const reverseTargets = (): CatalogItem[] => {
  const ids = new Set<ItemId>();
  for (const item of catalog.items) {
    for (const name of Object.keys(item.recycle)) {
      const target = itemByRecipeName(name);
      if (target) ids.add(target.id);
    }
  }
  return [...ids]
    .map((id) => itemsById.get(id))
    .filter((item): item is CatalogItem => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
};

export const reverseSources = (targetId: ItemId): SourceOption[] => {
  const target = itemsById.get(targetId);
  if (!target) return [];
  return catalog.items
    .flatMap((item): SourceOption[] => {
      const outputQty = item.recycle[target.name] ?? 0;
      if (outputQty <= 0) return [];
      return [
        {
          item,
          outputQty,
          yieldPerSlot: outputQty * item.stack,
          sellPerOutput: item.sell / outputQty,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.yieldPerSlot - left.yieldPerSlot ||
        left.sellPerOutput - right.sellPerOutput ||
        left.item.name.localeCompare(right.item.name, "fr"),
    );
};

export const planTarget = (targetId: ItemId, needed: number): TargetPlan[] =>
  reverseSources(targetId)
    .map((source) => {
      const unitsNeeded = Math.ceil(needed / source.outputQty);
      return {
        ...source,
        unitsNeeded,
        slotsNeeded: slotsFor({ qty: unitsNeeded, stack: source.item.stack }),
        leftover: unitsNeeded * source.outputQty - needed,
      };
    })
    .sort(
      (left, right) =>
        left.slotsNeeded - right.slotsNeeded ||
        left.sellPerOutput - right.sellPerOutput ||
        left.unitsNeeded - right.unitsNeeded,
    );

export const missingSourcePlans = (name: string, qty: number, limit = 3): TargetPlan[] => {
  const target = itemByRecipeName(name);
  if (!target || qty <= 0) return [];
  return planTarget(target.id, qty).slice(0, limit);
};
