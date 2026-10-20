import rawCatalog from "../data/catalog.json";
import {
  isRarity,
  toItemId,
  toItemName,
  type Catalog,
  type CatalogItem,
  type Ingredient,
  type Rarity,
  type Recipe,
  type RecycleYields,
  type UsedIn,
} from "./catalog-types";

export type {
  Catalog,
  CatalogItem,
  Ingredient,
  ItemId,
  ItemName,
  Rarity,
  Recipe,
  RecycleYields,
  UsedIn,
} from "./catalog-types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string, path: string): string => {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${path}.${key} must be a string`);
  return value;
};

const readNumber = (record: Record<string, unknown>, key: string, path: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} must be a finite number`);
  }
  return value;
};

const readBoolean = (record: Record<string, unknown>, key: string, path: string): boolean => {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`${path}.${key} must be a boolean`);
  return value;
};

const readArray = <Value>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  parseEntry: (entry: unknown, entryPath: string) => Value,
): Value[] => {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`${path}.${key} must be an array`);
  return value.map((entry, index) => parseEntry(entry, `${path}.${key}[${index}]`));
};

const readStringArray = (record: Record<string, unknown>, key: string, path: string): string[] =>
  readArray(record, key, path, (entry, entryPath) => {
    if (typeof entry !== "string") throw new Error(`${entryPath} must be a string`);
    return entry;
  });

const readNumberRecord = (
  record: Record<string, unknown>,
  key: string,
  path: string,
): RecycleYields => {
  const value = record[key];
  if (!isRecord(value)) throw new Error(`${path}.${key} must be an object`);
  return Object.fromEntries(
    Object.entries(value).map(([name, qty]) => {
      if (typeof qty !== "number" || !Number.isFinite(qty)) {
        throw new Error(`${path}.${key}.${name} must be a finite number`);
      }
      return [name, qty];
    }),
  );
};

const parseIngredient = (entry: unknown, path: string): Ingredient => {
  if (!isRecord(entry)) throw new Error(`${path} must be an object`);
  return {
    item: toItemName(readString(entry, "item", path)),
    qty: readNumber(entry, "qty", path),
  };
};

const parseRecipe = (entry: unknown, path: string): Recipe => {
  if (!isRecord(entry)) throw new Error(`${path} must be an object`);
  return {
    resultQty: readNumber(entry, "resultQty", path),
    station: readString(entry, "station", path),
    blueprint: readBoolean(entry, "blueprint", path),
    ingredients: readArray(entry, "ingredients", path, parseIngredient),
  };
};

const parseUsedIn = (entry: unknown, path: string): UsedIn => {
  if (!isRecord(entry)) throw new Error(`${path} must be an object`);
  return {
    result: toItemName(readString(entry, "result", path)),
    qty: readNumber(entry, "qty", path),
    station: readString(entry, "station", path),
  };
};

const parseItem = (entry: unknown, path: string): CatalogItem => {
  if (!isRecord(entry)) throw new Error(`${path} must be an object`);
  const image = entry.image;
  if (image !== null && typeof image !== "string") {
    throw new Error(`${path}.image must be a string or null`);
  }
  return {
    id: toItemId(readString(entry, "id", path)),
    name: toItemName(readString(entry, "name", path)),
    rarity: readString(entry, "rarity", path),
    rarityRank: readNumber(entry, "rarityRank", path),
    type: readString(entry, "type", path),
    weight: readNumber(entry, "weight", path),
    stack: readNumber(entry, "stack", path),
    sell: readNumber(entry, "sell", path),
    locations: readStringArray(entry, "locations", path),
    image,
    recycle: readNumberRecord(entry, "recycle", path),
    craftedFrom: readArray(entry, "craftedFrom", path, parseRecipe),
    usedIn: readArray(entry, "usedIn", path, parseUsedIn),
  };
};

export const parseCatalog = (input: unknown): Catalog => {
  if (!isRecord(input)) throw new Error("catalog must be an object");
  const counts = input.counts;
  if (!isRecord(counts)) throw new Error("catalog.counts must be an object");
  return {
    generatedAt: readString(input, "generatedAt", "catalog"),
    source: readString(input, "source", "catalog"),
    sourceUrl: readString(input, "sourceUrl", "catalog"),
    counts: {
      items: readNumber(counts, "items", "catalog.counts"),
      recycling: readNumber(counts, "recycling", "catalog.counts"),
      crafting: readNumber(counts, "crafting", "catalog.counts"),
      unknownOutputs: readNumber(counts, "unknownOutputs", "catalog.counts"),
    },
    unknownOutputs: readStringArray(input, "unknownOutputs", "catalog"),
    items: readArray(input, "items", "catalog", parseItem),
  };
};

export const catalog = parseCatalog(rawCatalog);

export const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
export const itemsByName = new Map(catalog.items.map((item) => [item.name, item]));

export const itemByRecipeName = (name: string): CatalogItem | undefined =>
  itemsByName.get(toItemName(name));

export const rarityLabels: Record<Rarity, string> = {
  Common: "Commun",
  Uncommon: "Peu commun",
  Rare: "Rare",
  Epic: "Épique",
  Legendary: "Légendaire",
  Amplified: "Amplifié",
};

export const typeLabels: Record<string, string> = {
  Recyclable: "Recyclable",
  "Quick Use": "Consommable",
  Trinket: "Objet de valeur",
  "Topside Material": "Matériau de surface",
  "Refined Material": "Matériau raffiné",
  "Basic Material": "Matériau basique",
  Augment: "Augment",
  Mods: "Mod",
  Nature: "Ressource naturelle",
  Ammunition: "Munitions",
  Shield: "Bouclier",
  Weapon: "Arme",
  "Research Item": "Recherche",
  "Quest Item": "Objet de quête",
  Key: "Clé",
  Blueprint: "Plan",
  Misc: "Divers",
  Divers: "Divers",
};

export const hiddenFromLoot = new Set(["Blueprint", "Key", "Quest Item", "Research Item"]);

const foldText = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const searchItems = (query: string, includeHidden: boolean): CatalogItem[] => {
  const needle = foldText(query.trim());
  return catalog.items.filter((item) => {
    if (!includeHidden && hiddenFromLoot.has(item.type)) return false;
    if (!needle) return true;
    return foldText(item.name).includes(needle) || foldText(item.type).includes(needle);
  });
};

export const rarityLabel = (rarity: string): string =>
  isRarity(rarity) ? rarityLabels[rarity] : rarity;

export const typeLabel = (type: string): string => typeLabels[type] ?? type;

export const recycleEntries = (item: CatalogItem): [string, number][] =>
  Object.entries(item.recycle).sort(([, left], [, right]) => right - left);

export const recipeTargets = new Map<string, CatalogItem[]>();
for (const item of catalog.items) {
  for (const use of item.usedIn) {
    const target = itemsByName.get(use.result);
    if (!target) continue;
    const existing = recipeTargets.get(item.id) ?? [];
    if (!existing.some((candidate) => candidate.id === target.id)) existing.push(target);
    recipeTargets.set(item.id, existing);
  }
}
