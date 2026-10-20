import { itemByRecipeName, itemsById, type CatalogItem } from "./catalog";
import type { ItemId } from "./catalog-types";
import { CAPACITY_ADVICE_LIMIT } from "./constants";

export type InventoryLine = { id: ItemId; qty: number };
export type ValueMode = "sell" | "recycle";

export type LineStats = {
  item: CatalogItem;
  qty: number;
  slots: number;
  sellValue: number;
  recycleValue: number;
  density: number;
};

export type LineSummary = {
  stats: LineStats[];
  slots: number;
  sellValue: number;
  recycleValue: number;
  bestValue: number;
  density: number;
};

export const slotsFor = ({ qty, stack }: { qty: number; stack: number }): number =>
  Math.max(0, Math.ceil(qty / Math.max(1, stack)));

export const outputValue = (outputs: Record<string, number>, multiplier = 1): number =>
  Object.entries(outputs).reduce((total, [name, qty]) => {
    const output = itemByRecipeName(name);
    return total + (output?.sell ?? 0) * qty * multiplier;
  }, 0);

export const lineStats = (line: InventoryLine): LineStats | null => {
  const item = itemsById.get(line.id);
  if (!item) return null;
  const qty = Math.max(0, Math.floor(line.qty));
  const slots = slotsFor({ qty, stack: item.stack });
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

export const bestValue = (stats: LineStats, mode: ValueMode): number =>
  mode === "sell" ? stats.sellValue : stats.recycleValue;

export const summarizeLines = (lines: InventoryLine[]): LineSummary => {
  const stats = statsForLines(lines);
  const slots = stats.reduce((total, entry) => total + entry.slots, 0);
  const sellValue = stats.reduce((total, entry) => total + entry.sellValue, 0);
  const recycleValue = stats.reduce((total, entry) => total + entry.recycleValue, 0);
  const best = Math.max(sellValue, recycleValue);
  return {
    stats,
    slots,
    sellValue,
    recycleValue,
    bestValue: best,
    density: slots > 0 ? best / slots : 0,
  };
};

export const totalSlots = (lines: InventoryLine[]): number =>
  statsForLines(lines).reduce((total, stats) => total + stats.slots, 0);

export const capacityAdvice = (
  lines: InventoryLine[],
  capacity: number,
  mode: ValueMode,
  limit = CAPACITY_ADVICE_LIMIT,
): LineStats[] => {
  if (totalSlots(lines) <= capacity) return [];
  return statsForLines(lines)
    .sort(
      (left, right) =>
        bestValue(left, mode) / Math.max(1, left.slots) -
        bestValue(right, mode) / Math.max(1, right.slots),
    )
    .slice(0, limit);
};

export const formatCredits = (value: number): string => Math.round(value).toLocaleString("fr-FR");
