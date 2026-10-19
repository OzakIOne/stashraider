import {
  catalog,
  itemsById,
  itemsByName,
  recycleEntries,
  salvageEntries,
  type CatalogItem,
} from "./catalog";

export type InventoryLine = { id: string; qty: number };
export type ValueMode = "sell" | "recycle";
export type YieldKind = "recycle" | "salvage";
export type ActionKind = YieldKind | "sell" | "keep";

export type LineStats = {
  item: CatalogItem;
  qty: number;
  slots: number;
  sellValue: number;
  recycleValue: number;
  salvageValue: number;
  bestYieldValue: number;
  bestYieldKind: YieldKind;
  density: number;
  fullStackValue: number;
};

export type Recommendation = {
  kind: ActionKind;
  label: string;
  value: number;
  detail: string;
};

export type ActionPlan = {
  stats: LineStats;
  recommendation: Recommendation;
};

export type SourceOption = {
  item: CatalogItem;
  outputQty: number;
  yieldPerSlot: number;
  sellPerOutput: number;
  slotsPerStack: number;
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
  const salvageValue = outputValue(item.salvage, qty);
  const bestYieldValue = Math.max(recycleValue, salvageValue);
  const bestYieldKind: YieldKind = recycleValue >= salvageValue ? "recycle" : "salvage";
  const bestValue = Math.max(sellValue, bestYieldValue);
  return {
    item,
    qty,
    slots,
    sellValue,
    recycleValue,
    salvageValue,
    bestYieldValue,
    bestYieldKind,
    density: slots > 0 ? bestValue / slots : 0,
    fullStackValue: item.sell * item.stack,
  };
};

export const statsForLines = (lines: InventoryLine[]): LineStats[] =>
  lines.flatMap((line) => {
    const stats = lineStats(line);
    return stats && stats.qty > 0 ? [stats] : [];
  });

export const recommend = (stats: LineStats): Recommendation => {
  const { item, sellValue, recycleValue, salvageValue, bestYieldValue, bestYieldKind } = stats;
  const yieldLabel = bestYieldKind === "recycle" ? "Recyclage" : "Salvage";
  const yieldAction = bestYieldKind === "recycle" ? "Recycler" : "Salvager";

  if (bestYieldValue > sellValue * 1.08 && bestYieldValue > 0) {
    const gain = bestYieldValue - sellValue;
    return {
      kind: bestYieldKind,
      label: yieldAction,
      value: bestYieldValue,
      detail: `${yieldLabel} ${formatCredits(bestYieldValue)} CR contre ${formatCredits(sellValue)} CR à la vente (+${formatCredits(gain)} CR).`,
    };
  }

  if (item.usedIn.length > 0 && item.rarityRank >= 2) {
    return {
      kind: "keep",
      label: "Garder",
      value: Math.max(sellValue, bestYieldValue),
      detail: `${item.usedIn.length} recette${item.usedIn.length > 1 ? "s" : ""} utilise${item.usedIn.length > 1 ? "nt" : ""} cet item. À vendre seulement en surplus.`,
    };
  }

  if (sellValue > 0) {
    const gain = sellValue - bestYieldValue;
    return {
      kind: "sell",
      label: "Vendre",
      value: sellValue,
      detail: `Vente ${formatCredits(sellValue)} CR contre ${formatCredits(bestYieldValue)} CR en ${yieldLabel.toLowerCase()}${gain > 0 ? ` (+${formatCredits(gain)} CR)` : ""}.`,
    };
  }

  if (recycleValue > 0 || salvageValue > 0) {
    return {
      kind: bestYieldKind,
      label: yieldAction,
      value: bestYieldValue,
      detail: `Aucune valeur de vente. ${yieldLabel} pour récupérer des matériaux.`,
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
  mode === "sell" ? stats.sellValue : stats.bestYieldValue;

export const sortedByDensity = (lines: InventoryLine[], mode: ValueMode): LineStats[] =>
  statsForLines(lines)
    .map((stats) => ({ stats, value: bestValue(stats, mode) }))
    .sort(
      (left, right) =>
        right.value / Math.max(1, right.stats.slots) - left.value / Math.max(1, left.stats.slots),
    )
    .map((entry) => entry.stats);

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

export const fullStackDensity = (item: CatalogItem, mode: ValueMode): number => {
  const sell = item.sell * item.stack;
  const recycle = Math.max(outputValue(item.recycle), outputValue(item.salvage)) * item.stack;
  return mode === "sell" ? sell : recycle;
};

export const reverseTargets = (): CatalogItem[] => {
  const ids = new Set<string>();
  for (const item of catalog.items) {
    for (const name of Object.keys(item.recycle)) {
      const target = itemsByName.get(name);
      if (target) ids.add(target.id);
    }
    for (const name of Object.keys(item.salvage)) {
      const target = itemsByName.get(name);
      if (target) ids.add(target.id);
    }
  }
  return [...ids]
    .map((id) => itemsById.get(id))
    .filter((item): item is CatalogItem => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
};

export const reverseSources = (targetId: string, kind: YieldKind): SourceOption[] => {
  const target = itemsById.get(targetId);
  if (!target) return [];
  return catalog.items
    .flatMap((item): SourceOption[] => {
      const outputs = kind === "recycle" ? item.recycle : item.salvage;
      const outputQty = outputs[target.name] ?? 0;
      if (outputQty <= 0) return [];
      return [
        {
          item,
          outputQty,
          yieldPerSlot: outputQty * item.stack,
          sellPerOutput: item.sell / outputQty,
          slotsPerStack: 1,
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

export const planTarget = (targetId: string, kind: YieldKind, needed: number): TargetPlan[] =>
  reverseSources(targetId, kind)
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

export const yieldSummary = (
  item: CatalogItem,
  kind: YieldKind,
): { name: string; qty: number; known: boolean; value: number }[] => {
  const entries = kind === "recycle" ? recycleEntries(item) : salvageEntries(item);
  return entries.map(([name, qty]) => {
    const output = itemsByName.get(name);
    return { name, qty, known: Boolean(output), value: (output?.sell ?? 0) * qty };
  });
};

export const formatCredits = (value: number): string => Math.round(value).toLocaleString("fr-FR");

export const formatPercent = (value: number): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
