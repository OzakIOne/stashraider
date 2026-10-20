export type ItemId = string & { readonly __brand: "ItemId" };
export type ItemName = string & { readonly __brand: "ItemName" };

const itemIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isItemId = (value: string): value is ItemId => itemIdPattern.test(value);

export const toItemId = (value: string): ItemId => {
  if (!itemIdPattern.test(value)) throw new Error(`Invalid item id: ${value}`);
  return value as ItemId;
};

export const toItemName = (value: string): ItemName => {
  if (value.trim().length === 0) throw new Error("Item name cannot be empty");
  return value as ItemName;
};

export const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Amplified"] as const;

export type Rarity = (typeof rarities)[number];

export const isRarity = (value: string): value is Rarity =>
  rarities.some((rarity) => rarity === value);

export type Ingredient = { item: ItemName; qty: number };

export type Recipe = {
  resultQty: number;
  station: string;
  blueprint: boolean;
  ingredients: Ingredient[];
};

export type UsedIn = {
  result: ItemName;
  qty: number;
  station: string;
};

export type RecycleYields = Record<string, number>;

export type CatalogItem = {
  id: ItemId;
  name: ItemName;
  rarity: string;
  rarityRank: number;
  type: string;
  weight: number;
  stack: number;
  sell: number;
  locations: string[];
  image: string | null;
  recycle: RecycleYields;
  craftedFrom: Recipe[];
  usedIn: UsedIn[];
};

export type Catalog = {
  generatedAt: string;
  source: string;
  sourceUrl: string;
  counts: {
    items: number;
    recycling: number;
    crafting: number;
    unknownOutputs: number;
  };
  unknownOutputs: string[];
  items: CatalogItem[];
};
