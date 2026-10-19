import { catalog, itemsById, itemsByName, type CatalogItem } from "./catalog";

export type InventoryLine = { id: string; qty: number };
export type ValueMode = "sell" | "recycle";
export type ActionKind = "recycle" | "sell" | "keep";

export type LineStats = {
  item: CatalogItem;
  qty: number;
  slots: number;
  sellValue: number;
  recycleValue: number;
  density: number;
};

export type Recommendation = {
  kind: ActionKind;
  label: string;
  value: number;
  detail: string;
};

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

export const slotsFor = (qty: number, stack: number): number =>
  Math.max(0, Math.ceil(qty / Math.max(1, stack)));

export const outputValue = (outputs: Record<string, number>, multiplier = 1): number =>
  Object.entries(outputs).reduce((total, [name, qty]) => {
    const output = itemsByName.get(name);
    return total + (output?.sell ?? 0) * qty * multiplier;
  }, 0);

export const lineStats = (line: InventoryLine): LineStats | null => {
  const item = itemsById.get(line.id);
  if (!item) return null;
  const qty = Math.max(0, Math.floor(line.qty));
  const slots = slotsFor(qty, item.stack);
  const sellValue = item.sell * qty;
  const recycleValue = outputValue(item.recycle, qty);
  const bestValue = Math.max(sellValue, recycleValue);
  return {
    item,
    qty,
    slots,
    sellValue,
    recycleValue,
    density: slots > 0 ? bestValue / slots : 0,
  };
};

export const statsForLines = (lines: InventoryLine[]): LineStats[] =>
  lines.flatMap((line) => {
    const stats = lineStats(line);
    return stats && stats.qty > 0 ? [stats] : [];
  });

export const recommend = (stats: LineStats): Recommendation => {
  const { item, sellValue, recycleValue } = stats;

  if (recycleValue > sellValue * 1.08 && recycleValue > 0) {
    const gain = recycleValue - sellValue;
    return {
      kind: "recycle",
      label: "Recycler",
      value: recycleValue,
      detail: `Recyclage ${formatCredits(recycleValue)} CR contre ${formatCredits(sellValue)} CR à la vente (+${formatCredits(gain)} CR).`,
    };
  }

  if (item.usedIn.length > 0 && item.rarityRank >= 2) {
    return {
      kind: "keep",
      label: "Garder",
      value: Math.max(sellValue, recycleValue),
      detail: `${item.usedIn.length} recette${item.usedIn.length > 1 ? "s" : ""} utilise${item.usedIn.length > 1 ? "nt" : ""} cet item. À vendre seulement en surplus.`,
    };
  }

  if (sellValue > 0) {
    const gain = sellValue - recycleValue;
    return {
      kind: "sell",
      label: "Vendre",
      value: sellValue,
      detail: `Vente ${formatCredits(sellValue)} CR contre ${formatCredits(recycleValue)} CR en recyclage${gain > 0 ? ` (+${formatCredits(gain)} CR)` : ""}.`,
    };
  }

  if (recycleValue > 0) {
    return {
      kind: "recycle",
      label: "Recycler",
      value: recycleValue,
      detail: "Aucune valeur de vente. Recyclage pour récupérer des matériaux.",
    };
  }

  return {
    kind: "keep",
    label: "Garder",
    value: 0,
    detail: "Aucune valeur de vente ni de recyclage connue.",
  };
};

export const bestValue = (stats: LineStats, mode: ValueMode): number =>
  mode === "sell" ? stats.sellValue : stats.recycleValue;

export const totalSlots = (lines: InventoryLine[]): number =>
  statsForLines(lines).reduce((total, stats) => total + stats.slots, 0);

export const totalValue = (lines: InventoryLine[], mode: ValueMode): number =>
  statsForLines(lines).reduce((total, stats) => total + bestValue(stats, mode), 0);

export const capacityAdvice = (
  lines: InventoryLine[],
  capacity: number,
  mode: ValueMode,
  limit = 4,
): LineStats[] => {
  const over = totalSlots(lines) - capacity;
  if (over <= 0) return [];
  return statsForLines(lines)
    .sort(
      (left, right) =>
        bestValue(left, mode) / Math.max(1, left.slots) -
        bestValue(right, mode) / Math.max(1, right.slots),
    )
    .slice(0, limit);
};

export const reverseTargets = (): CatalogItem[] => {
  const ids = new Set<string>();
  for (const item of catalog.items) {
    for (const name of Object.keys(item.recycle)) {
      const target = itemsByName.get(name);
      if (target) ids.add(target.id);
    }
  }
  return [...ids]
    .map((id) => itemsById.get(id))
    .filter((item): item is CatalogItem => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
};

export const reverseSources = (targetId: string): SourceOption[] => {
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

export const planTarget = (targetId: string, needed: number): TargetPlan[] =>
  reverseSources(targetId)
    .map((source) => {
      const unitsNeeded = Math.ceil(needed / source.outputQty);
      return {
        ...source,
        unitsNeeded,
        slotsNeeded: slotsFor(unitsNeeded, source.item.stack),
        leftover: unitsNeeded * source.outputQty - needed,
      };
    })
    .sort(
      (left, right) =>
        left.slotsNeeded - right.slotsNeeded ||
        left.sellPerOutput - right.sellPerOutput ||
        left.unitsNeeded - right.unitsNeeded,
    );

export const formatCredits = (value: number): string => Math.round(value).toLocaleString("fr-FR");
