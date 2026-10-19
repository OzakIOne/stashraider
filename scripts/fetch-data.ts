import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const API = "https://arcraiders.wiki/w/api.php";
const ICON_DIR = "public/icons";
const DATA_FILE = "src/data/catalog.json";
const PAGE_SIZE = 500;
const ICON_WIDTH = 128;

type CargoRow = Record<string, string>;
type ItemRow = CargoRow & { name: string };

type Ingredient = { item: string; qty: number };

type CatalogItem = {
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

type Recipe = {
  resultQty: number;
  station: string;
  blueprint: boolean;
  ingredients: Ingredient[];
};

type UsedIn = {
  result: string;
  qty: number;
  station: string;
};

const rarityRanks: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Amplified: 5,
};

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { "user-agent": "stashraider-data-sync/1.0 (community fan tool)" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
};

const orderBy: Record<string, string> = {
  items: "name",
  recycling: "inputItem",
  crafting: "resultItem",
};

const cargoQuery = async (tables: string, fields: string): Promise<CargoRow[]> => {
  const rows: CargoRow[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      action: "cargoquery",
      tables,
      fields,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      order_by: orderBy[tables] ?? "name",
      format: "json",
    });
    const payload = (await fetchJson(`${API}?${params}`)) as {
      cargoquery?: { title: CargoRow }[];
      error?: { info: string };
    };
    if (payload.error) throw new Error(`Cargo error: ${payload.error.info}`);
    const batch = (payload.cargoquery ?? []).map((entry) => entry.title);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
};

const toNumber = (value: string | undefined): number => {
  if (!value) return 0;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseIngredients = (value: string | undefined): Ingredient[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .flatMap((part) => {
      const match = part.match(/^(.+):(\d+)$/);
      if (!match) return [];
      const [, item, qty] = match;
      if (!item || !qty) return [];
      return [{ item: item.trim(), qty: Number(qty) }];
    })
    .filter((ingredient) => ingredient.qty > 0);
};

const slugify = (name: string): string =>
  name
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "") || "item";

const iconExtension = (bytes: Uint8Array): string => {
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)
    return "webp";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  return "img";
};

const existingIcon = async (slug: string): Promise<string | null> => {
  for (const extension of ["webp", "png", "jpg", "img"]) {
    const path = join(ICON_DIR, `${slug}.${extension}`);
    if (existsSync(path)) return `/icons/${slug}.${extension}`;
  }
  return null;
};

const downloadIcon = async (slug: string, file: string): Promise<string | null> => {
  const cached = await existingIcon(slug);
  if (cached) return cached;
  const fileName = file.replace(/^File:/, "");
  const url = `https://arcraiders.wiki/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${ICON_WIDTH}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    const response = await fetch(url, {
      headers: { "user-agent": "stashraider-data-sync/1.0 (community fan tool)" },
    });
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) continue;
    const extension = iconExtension(bytes);
    await writeFile(join(ICON_DIR, `${slug}.${extension}`), bytes);
    return `/icons/${slug}.${extension}`;
  }
  return null;
};

const mapWithConcurrency = async <Input, Output>(
  inputs: Input[],
  concurrency: number,
  mapper: (input: Input) => Promise<Output>,
): Promise<Output[]> => {
  const results: Output[] = Array.from({ length: inputs.length });
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
    for (;;) {
      const index = cursor++;
      const input = inputs[index];
      if (input === undefined) return;
      results[index] = await mapper(input);
    }
  });
  await Promise.all(workers);
  return results;
};

const main = async () => {
  await mkdir(ICON_DIR, { recursive: true });
  await mkdir("src/data", { recursive: true });

  console.info("Fetching items from arcraiders.wiki…");
  const rawItemRows = await cargoQuery(
    "items",
    "name,image,rarity,type,weight,stacksize,sellprice,location",
  );
  const itemRows: ItemRow[] = rawItemRows.flatMap((row): ItemRow[] =>
    row.name ? [{ ...row, name: row.name }] : [],
  );
  console.info(`  ${itemRows.length} items`);

  console.info("Fetching recycling yields…");
  const recyclingRows = (
    await cargoQuery("recycling", "recipeType,inputItem,outputItem,outputQty")
  ).filter((row) => row.recipeType === "recycling");
  console.info(`  ${recyclingRows.length} recycling yield rows`);

  console.info("Fetching crafting recipes…");
  const craftingRows = await cargoQuery(
    "crafting",
    "resultItem,resultQty,ingredients,requireBlueprint,requireStation",
  );
  console.info(`  ${craftingRows.length} recipes`);

  const names = new Set(itemRows.map((row) => row.name));
  const usedIds = new Set<string>();

  const idFor = (row: ItemRow): string => {
    const base = slugify(row.name);
    const variant = row.rarity ? slugify(row.rarity) : "variant";
    let candidate = base;
    if (usedIds.has(candidate)) candidate = `${base}-${variant}`;
    let suffix = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${variant}-${suffix++}`;
    usedIds.add(candidate);
    return candidate;
  };

  const rowsWithIds = itemRows.map((row) => ({ row, id: idFor(row) }));

  const recipesByResult = new Map<string, Recipe[]>();
  const usedInByItem = new Map<string, UsedIn[]>();

  for (const row of craftingRows) {
    const ingredients = parseIngredients(row.ingredients);
    if (ingredients.length === 0) continue;
    const station = row.requireStation ?? "";
    const recipe: Recipe = {
      resultQty: Math.max(1, toNumber(row.resultQty)),
      station,
      blueprint: Boolean(row.requireBlueprint),
      ingredients,
    };
    const result = row.resultItem;
    if (!result) continue;
    const existing = recipesByResult.get(result) ?? [];
    const duplicate = existing.some(
      (candidate) =>
        candidate.station === recipe.station &&
        candidate.ingredients.length === recipe.ingredients.length &&
        candidate.ingredients.every((ingredient, index) => {
          const other = recipe.ingredients[index];
          return other?.item === ingredient.item && other.qty === ingredient.qty;
        }),
    );
    if (!duplicate) {
      existing.push(recipe);
      recipesByResult.set(result, existing);
    }
    for (const ingredient of ingredients) {
      const uses = usedInByItem.get(ingredient.item) ?? [];
      const duplicateUse = uses.some(
        (use) => use.result === result && use.qty === ingredient.qty && use.station === station,
      );
      if (!duplicateUse) {
        uses.push({ result, qty: ingredient.qty, station });
        usedInByItem.set(ingredient.item, uses);
      }
    }
  }

  const recycleByItem = new Map<string, Record<string, number>>();
  for (const row of recyclingRows) {
    const qty = toNumber(row.outputQty);
    if (!row.inputItem || !row.outputItem || qty <= 0) continue;
    const outputs = recycleByItem.get(row.inputItem) ?? {};
    outputs[row.outputItem] = (outputs[row.outputItem] ?? 0) + qty;
    recycleByItem.set(row.inputItem, outputs);
  }

  console.info(`Downloading ${itemRows.length} icons (cached files are skipped)…`);
  let downloaded = 0;
  let failed = 0;
  const items: CatalogItem[] = await mapWithConcurrency(rowsWithIds, 5, async ({ row, id }) => {
    const image = row.image ? await downloadIcon(id, row.image) : null;
    if (image) downloaded += 1;
    else failed += 1;
    return {
      id,
      name: row.name,
      rarity: row.rarity || "Common",
      rarityRank: rarityRanks[row.rarity || "Common"] ?? 0,
      type: row.type || "Divers",
      weight: toNumber(row.weight),
      stack: Math.max(1, toNumber(row.stacksize)),
      sell: toNumber(row.sellprice),
      locations: (row.location ?? "")
        .split(",")
        .map((location) => location.trim())
        .filter(Boolean),
      image,
      recycle: recycleByItem.get(row.name) ?? {},
      craftedFrom: recipesByResult.get(row.name) ?? [],
      usedIn: usedInByItem.get(row.name) ?? [],
    };
  });
  console.info(`  ${downloaded} icons present, ${failed} missing`);

  items.sort(
    (left, right) =>
      right.rarityRank - left.rarityRank ||
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

  const unknownOutputs = new Set<string>();
  for (const outputs of recycleByItem.values()) {
    for (const output of Object.keys(outputs)) {
      if (!names.has(output)) unknownOutputs.add(output);
    }
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: "ARC Raiders Wiki",
    sourceUrl: "https://arcraiders.wiki",
    counts: {
      items: items.length,
      recycling: recyclingRows.length,
      crafting: craftingRows.length,
      unknownOutputs: unknownOutputs.size,
    },
    unknownOutputs: [...unknownOutputs].sort(),
    items,
  };

  type ExistingCatalog = { generatedAt?: string };

  let previous: ExistingCatalog | null = null;
  try {
    previous = JSON.parse(await readFile(DATA_FILE, "utf8")) as ExistingCatalog;
  } catch {
    previous = null;
  }

  if (previous?.generatedAt) {
    const comparable = (value: ExistingCatalog) =>
      JSON.stringify({ ...value, generatedAt: undefined });
    if (comparable(previous) === comparable(catalog)) {
      catalog.generatedAt = previous.generatedAt;
    }
  }

  await writeFile(DATA_FILE, `${JSON.stringify(catalog, null, 2)}\n`);

  const rocketeer = items.find((item) => item.name === "Rocketeer Driver");
  console.info(`Wrote ${items.length} items to ${DATA_FILE}`);
  if (rocketeer) {
    console.info(`Rocketeer Driver check → recycle ${JSON.stringify(rocketeer.recycle)}`);
  }
  if (unknownOutputs.size > 0) {
    console.info(`Unknown recycling outputs: ${[...unknownOutputs].join(", ")}`);
  }
};

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { name: string };
console.info(`${packageJson.name}: syncing game data`);
await main();
