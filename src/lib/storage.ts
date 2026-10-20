import { itemsById } from "./catalog";
import { isItemId, type ItemId } from "./catalog-types";
import { MAX_CAPACITY, MAX_QTY } from "./constants";
import type { InventoryLine, ValueMode } from "./line-stats";
import type { Goal } from "./retention";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const decodeEntries = (input: unknown): { id: ItemId; qty: number }[] | null => {
  if (!Array.isArray(input)) return null;
  return input.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { id, qty } = entry;
    if (typeof id !== "string" || !isItemId(id) || !itemsById.has(id)) return [];
    if (typeof qty !== "number" || !Number.isFinite(qty)) return [];
    return [{ id, qty: Math.min(MAX_QTY, Math.max(1, Math.floor(qty))) }];
  });
};

export const decodeInventory = (input: unknown): InventoryLine[] | null => decodeEntries(input);

export const decodeGoals = (input: unknown): Goal[] | null => decodeEntries(input);

export const decodeCapacity = (input: unknown): number | null => {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  return Math.min(MAX_CAPACITY, Math.max(1, Math.floor(input)));
};

export const decodeValueMode = (input: unknown): ValueMode | null =>
  input === "sell" || input === "recycle" ? input : null;
