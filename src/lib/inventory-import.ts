import { catalog, type CatalogItem } from "./catalog";
import type { InventoryLine } from "./optimizer";

export type ImportResult = {
  lines: InventoryLine[];
  unknown: string[];
};

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

const lookup = new Map<string, CatalogItem>();
for (const item of catalog.items) {
  const key = normalize(item.name);
  if (!lookup.has(key)) lookup.set(key, item);
}

const quantityLast = /^(.+?)\s*[x×]\s*(\d+)$/i;
const quantityFirst = /^(\d+)\s*(?:[x×]\s*)?(.+)$/i;
const numberLast = /^(.+?)\s+(\d+)$/i;

const parseLine = (raw: string): { name: string; qty: number } | null => {
  const line = raw.trim().replace(/^[-*•]\s*/, "");
  if (!line || line.startsWith("#")) return null;

  const last = line.match(quantityLast);
  if (last?.[1] && last[2]) return { name: last[1].trim(), qty: Number(last[2]) };

  const first = line.match(quantityFirst);
  if (first?.[1] && first[2]) return { name: first[2].trim(), qty: Number(first[1]) };

  const tail = line.match(numberLast);
  if (tail?.[1] && tail[2]) return { name: tail[1].trim(), qty: Number(tail[2]) };

  return { name: line, qty: 1 };
};

export const parseInventoryText = (text: string): ImportResult => {
  const quantities = new Map<string, number>();
  const unknown: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const item = lookup.get(normalize(parsed.name));
    if (!item) {
      unknown.push(parsed.name);
      continue;
    }
    const qty = Math.max(1, Math.min(9999, Math.floor(parsed.qty)));
    quantities.set(item.id, (quantities.get(item.id) ?? 0) + qty);
  }

  return {
    lines: [...quantities].map(([id, qty]) => ({ id, qty })),
    unknown,
  };
};
