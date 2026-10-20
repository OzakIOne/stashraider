import catalogData from "../data/catalog.json";

export type Recipe = {
  resultQty: number;
  station: string;
  blueprint: boolean;
  ingredients: { item: string; qty: number }[];
};

export type UsedIn = {
  result: string;
  qty: number;
  station: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  rarity: string;
  rarityRank: number;
  type: string;
  weight: number;
  stack: number;
  sell: number;
  locations: string[];
  image: string | null;
  recycle: Record<string, number>;
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

export const catalog = catalogData as unknown as Catalog;

export const itemsById = new Map(catalog.items.map((item) => [item.id, item]));
export const itemsByName = new Map(catalog.items.map((item) => [item.name, item]));

export const rarityLabels: Record<string, string> = {
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

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const searchItems = (query: string, includeHidden: boolean): CatalogItem[] => {
  const needle = normalize(query.trim());
  return catalog.items.filter((item) => {
    if (!includeHidden && hiddenFromLoot.has(item.type)) return false;
    if (!needle) return true;
    return normalize(item.name).includes(needle) || normalize(item.type).includes(needle);
  });
};

export const rarityLabel = (rarity: string): string => rarityLabels[rarity] ?? rarity;
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
