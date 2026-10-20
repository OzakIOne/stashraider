import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  toItemId,
  toItemName,
  type Catalog,
  type CatalogItem,
  type Ingredient,
  type ItemId,
  type ItemName,
  type Recipe,
  type UsedIn,
} from "../src/lib/catalog-types";

const API = "https://arcraiders.wiki/w/api.php";
const ICON_DIR = "public/icons";
const DATA_FILE = "src/data/catalog.json";
const PAGE_SIZE = 500;
const ICON_WIDTH = 128;

type CargoRow = Record<string, string>;
type ItemRow = CargoRow & { name: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
};

const readString = (record: Record<string, unknown>, key: string, path: string): string => {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${path}.${key} must be a string`);
  return value;
};

const readArray = (record: Record<string, unknown>, key: string, path: string): unknown[] => {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`${path}.${key} must be an array`);
  return value;
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

const parseCargoRows = (payload: unknown): CargoRow[] => {
  const body = readRecord(payload, "cargo payload");
  if (body.error !== undefined) {
    throw new Error(
      `Cargo error: ${readString(readRecord(body.error, "cargo.error"), "info", "cargo.error")}`,
    );
  }
  if (body.cargoquery === undefined) return [];
  return readArray(body, "cargoquery", "cargo payload").map((entry, index) => {
    const path = `cargoquery[${index}]`;
    const title = readRecord(readRecord(entry, path).title, `${path}.title`);
    return Object.fromEntries(
      Object.entries(title).map(([key, value]) => [
        key,
        typeof value === "string" ? value : String(value),
      ]),
    );
  });
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
    const batch = parseCargoRows(await fetchJson(`${API}?${params}`));
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
      const match = part.match(/^(.+):(\d+)(?::[^:]*)?$/);
      if (!match) return [];
      const [, item, qty] = match;
      if (!item || !qty) return [];
      return [{ item: toItemName(item.trim()), qty: Number(qty) }];
    })
    .filter((ingredient) => ingredient.qty > 0);
};

const parseTemplateBody = (text: string, name: string): string | null => {
  const start = text.indexOf(`{{${name}`);
  if (start === -1) return null;
  let depth = 0;
  for (let index = start; index < text.length - 1; index++) {
    if (text.startsWith("{{", index)) {
      depth += 1;
      index += 1;
      continue;
    }
    if (text.startsWith("}}", index)) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start + 2 + name.length, index);
      }
      index += 1;
    }
  }
  return null;
};

const parseTemplateParams = (body: string | null): Record<string, string> => {
  if (!body) return {};
  const params: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*\|\s*([\w-]+)\s*=\s*(.*)$/);
    if (match?.[1]) params[match[1]] = match[2]?.trim() ?? "";
  }
  return params;
};

const parseRecipeIngredients = (value: string | undefined): Ingredient[] => {
  if (!value) return [];
  return value
    .split("+")
    .map((part) => part.trim())
    .flatMap((part) => {
      const match = part.match(/^(\d+)\s+(.+)$/);
      if (!match) return [];
      const [, qty, item] = match;
      if (!qty || !item || item === "?") return [];
      return [{ item: toItemName(item.trim()), qty: Number(qty) }];
    })
    .filter((ingredient) => ingredient.qty > 0);
};

const parsePriceList = (value: string | undefined): number[] =>
  (value ?? "")
    .split(/<br\s*\/?>/i)
    .map((price) => toNumber(price))
    .filter((price) => price > 0);

const roman = ["I", "II", "III", "IV", "V", "VI"];

type RawWeapon = {
  name: string;
  rarity: string;
  weight: number;
  sell: number;
  imageFile: string | null;
  fallbackImageFile: string | null;
  recycle: Record<string, number>;
};

const parseWeaponPage = (
  title: string,
  text: string,
): { items: RawWeapon[]; recipes: { result: ItemName; recipe: Recipe }[] } => {
  const info = parseTemplateParams(parseTemplateBody(text, "Infobox weapon"));
  const baseName = info.name || title;
  const prices = parsePriceList(info.sellprice);
  const upgrade = parseTemplateParams(parseTemplateBody(text, "Weapon upgrades"));
  const upgrades = [2, 3, 4]
    .map((level) => ({
      level,
      ingredients: parseRecipeIngredients(upgrade[`level${level}-ingredients`]),
    }))
    .filter((entry) => entry.ingredients.length > 0);
  const variantCount = Math.max(1, prices.length, upgrades.length + 1);
  const variantName = (index: number): string =>
    variantCount === 1 ? baseName : `${baseName} ${roman[index] ?? String(index + 1)}`;
  const variantNames = Array.from({ length: variantCount }, (_, index) => variantName(index));
  const imageFor = (index: number): string | null =>
    variantCount === 1
      ? (info.image ?? null)
      : `${baseName} ${roman[index] ?? String(index + 1)}.png`;

  const items: RawWeapon[] = variantNames.map((name, index) => ({
    name,
    rarity: info.rarity || "Common",
    weight: toNumber(info.weight),
    sell: prices[index] ?? 0,
    imageFile: imageFor(index),
    fallbackImageFile: variantCount === 1 ? null : (info.image ?? null),
    recycle: {},
  }));

  const recipes: { result: ItemName; recipe: Recipe }[] = [];
  const crafting = parseTemplateParams(parseTemplateBody(text, "Crafting"));
  const craftIngredients = parseRecipeIngredients(crafting.ingredients);
  if (crafting.result && craftIngredients.length > 0) {
    recipes.push({
      result: toItemName(variantCount === 1 ? baseName : crafting.result),
      recipe: {
        resultQty: 1,
        station: crafting.station ?? "",
        blueprint: crafting.blueprint === "y",
        ingredients: craftIngredients,
      },
    });
  }

  for (const [index, level] of upgrades.entries()) {
    const variantIndex = index + 1;
    if (variantIndex >= variantCount) continue;
    recipes.push({
      result: toItemName(variantName(variantIndex)),
      recipe: {
        resultQty: 1,
        station: upgrade.station ? `${upgrade.station} (upgrade)` : "Upgrade",
        blueprint: false,
        ingredients: level.ingredients,
      },
    });
  }

  const recycling = parseTemplateParams(parseTemplateBody(text, "Recycling table"));
  for (let index = 0; index < variantCount; index++) {
    const outputs = parseRecipeIngredients(recycling[`recycling${index + 1}`]);
    if (outputs.length === 0) continue;
    const canonical = variantName(index);
    const item = items.find((candidate) => candidate.name === canonical);
    if (!item) continue;
    for (const output of outputs) {
      item.recycle[output.item] = (item.recycle[output.item] ?? 0) + output.qty;
    }
  }

  return { items, recipes };
};

const parseCategoryMembers = (payload: unknown): { titles: string[]; next: string | undefined } => {
  const body = readRecord(payload, "category payload");
  const query = body.query === undefined ? {} : readRecord(body.query, "category payload.query");
  const members =
    query.categorymembers === undefined
      ? []
      : readArray(query, "categorymembers", "category payload.query");
  const titles = members.map((member, index) =>
    readString(
      readRecord(member, `categorymembers[${index}]`),
      "title",
      `categorymembers[${index}]`,
    ),
  );
  const continuation =
    body.continue === undefined
      ? undefined
      : readRecord(body.continue, "category payload.continue").cmcontinue;
  return { titles, next: typeof continuation === "string" ? continuation : undefined };
};

const parseRevisionPages = (payload: unknown): { title: string; text: string }[] => {
  const body = readRecord(payload, "revisions payload");
  const query = body.query === undefined ? {} : readRecord(body.query, "revisions payload.query");
  if (query.pages === undefined) return [];
  const pages = readRecord(query.pages, "revisions payload.query.pages");
  return Object.entries(pages).flatMap(([pageId, entry]) => {
    const page = readRecord(entry, `pages.${pageId}`);
    const title = readString(page, "title", `pages.${pageId}`);
    if (page.revisions === undefined) return [];
    const revision = readRecord(
      readArray(page, "revisions", `pages.${pageId}`)[0],
      `pages.${pageId}.revisions[0]`,
    );
    const slots = readRecord(revision.slots, `pages.${pageId}.revisions[0].slots`);
    const main = readRecord(slots.main, `pages.${pageId}.revisions[0].slots.main`);
    const text = main["*"];
    return typeof text === "string" ? [{ title, text }] : [];
  });
};

const fetchWeaponPages = async (): Promise<{ title: string; text: string }[]> => {
  const titles: string[] = [];
  let cmcontinue: string | undefined;
  for (;;) {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Weapons",
      cmtype: "page",
      cmlimit: "500",
      format: "json",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);
    const members = parseCategoryMembers(await fetchJson(`${API}?${params}`));
    titles.push(...members.titles);
    cmcontinue = members.next;
    if (!cmcontinue) break;
  }

  const pages: { title: string; text: string }[] = [];
  for (let index = 0; index < titles.length; index += 40) {
    const batch = titles.slice(index, index + 40);
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvslots: "main",
      rvprop: "content",
      titles: batch.join("|"),
      format: "json",
    });
    pages.push(...parseRevisionPages(await fetchJson(`${API}?${params}`)));
  }
  return pages;
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

  const usedIds = new Set<string>();

  const uniqueId = (name: string, rarity: string): ItemId => {
    const base = slugify(name);
    const variant = rarity ? slugify(rarity) : "variant";
    let candidate = base;
    if (usedIds.has(candidate)) candidate = `${base}-${variant}`;
    let suffix = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${variant}-${suffix++}`;
    usedIds.add(candidate);
    return toItemId(candidate);
  };

  const rowsWithIds = itemRows.map((row) => ({
    row,
    id: uniqueId(row.name, row.rarity || "Common"),
  }));

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
        uses.push({ result: toItemName(result), qty: ingredient.qty, station });
        usedInByItem.set(ingredient.item, uses);
      }
    }
  }

  console.info("Fetching weapon pages…");
  const weaponPages = await fetchWeaponPages();
  const rawWeapons: RawWeapon[] = [];
  let weaponRecipeCount = 0;

  for (const page of weaponPages) {
    const parsed = parseWeaponPage(page.title, page.text);
    for (const entry of parsed.recipes) {
      if (recipesByResult.has(entry.result)) continue;
      const existing = recipesByResult.get(entry.result) ?? [];
      const duplicate = existing.some(
        (candidate) =>
          candidate.station === entry.recipe.station &&
          candidate.ingredients.length === entry.recipe.ingredients.length &&
          candidate.ingredients.every((ingredient, index) => {
            const other = entry.recipe.ingredients[index];
            return other?.item === ingredient.item && other.qty === ingredient.qty;
          }),
      );
      if (duplicate) continue;
      existing.push(entry.recipe);
      recipesByResult.set(entry.result, existing);
      weaponRecipeCount += 1;
      for (const ingredient of entry.recipe.ingredients) {
        const uses = usedInByItem.get(ingredient.item) ?? [];
        const duplicateUse = uses.some(
          (use) =>
            use.result === entry.result &&
            use.qty === ingredient.qty &&
            use.station === entry.recipe.station,
        );
        if (!duplicateUse) {
          uses.push({
            result: entry.result,
            qty: ingredient.qty,
            station: entry.recipe.station,
          });
          usedInByItem.set(ingredient.item, uses);
        }
      }
    }
    rawWeapons.push(...parsed.items);
  }
  console.info(
    `  ${weaponPages.length} weapon pages, ${rawWeapons.length} variants, ${weaponRecipeCount} recipes`,
  );

  const recycleByItem = new Map<string, Record<string, number>>();
  for (const row of recyclingRows) {
    const qty = toNumber(row.outputQty);
    if (!row.inputItem || !row.outputItem || qty <= 0) continue;
    const outputs = recycleByItem.get(row.inputItem) ?? {};
    outputs[row.outputItem] = (outputs[row.outputItem] ?? 0) + qty;
    recycleByItem.set(row.inputItem, outputs);
  }

  let weaponYieldCount = 0;
  for (const weapon of rawWeapons) {
    if (recycleByItem.has(weapon.name)) continue;
    const entries = Object.entries(weapon.recycle);
    if (entries.length === 0) continue;
    const outputs = recycleByItem.get(weapon.name) ?? {};
    for (const [name, qty] of entries) outputs[name] = (outputs[name] ?? 0) + qty;
    recycleByItem.set(weapon.name, outputs);
    weaponYieldCount += entries.length;
  }

  const weaponRowsWithIds = rawWeapons.map((item) => ({
    item,
    id: uniqueId(item.name, item.rarity),
  }));

  type Seed = {
    id: ItemId;
    name: ItemName;
    rarity: string;
    type: string;
    weight: number;
    stack: number;
    sell: number;
    locations: string[];
    imageFile: string | null;
    fallbackImageFile?: string | null;
    recycle: Record<string, number>;
  };

  const seeds: Seed[] = [
    ...rowsWithIds.map(({ row, id }) => ({
      id,
      name: toItemName(row.name),
      rarity: row.rarity || "Common",
      type: row.type || "Divers",
      weight: toNumber(row.weight),
      stack: Math.max(1, toNumber(row.stacksize)),
      sell: toNumber(row.sellprice),
      locations: (row.location ?? "")
        .split(",")
        .map((location) => location.trim())
        .filter(Boolean),
      imageFile: row.image?.replace(/^File:/, "") ?? null,
      recycle: recycleByItem.get(row.name) ?? {},
    })),
    ...weaponRowsWithIds.map(({ item, id }) => ({
      id,
      name: toItemName(item.name),
      rarity: item.rarity,
      type: "Weapon",
      weight: item.weight,
      stack: 1,
      sell: item.sell,
      locations: [],
      imageFile: item.imageFile,
      fallbackImageFile: item.fallbackImageFile,
      recycle: recycleByItem.get(item.name) ?? {},
    })),
  ];

  const names = new Set<string>(seeds.map((seed) => seed.name));

  console.info(`Downloading ${seeds.length} icons (cached files are skipped)…`);
  let downloaded = 0;
  let failed = 0;
  const items: CatalogItem[] = await mapWithConcurrency(seeds, 5, async (seed) => {
    let image = seed.imageFile ? await downloadIcon(seed.id, seed.imageFile) : null;
    if (!image && seed.fallbackImageFile) {
      image = await downloadIcon(seed.id, seed.fallbackImageFile);
    }
    if (image) downloaded += 1;
    else failed += 1;
    return {
      id: seed.id,
      name: seed.name,
      rarity: seed.rarity,
      rarityRank: rarityRanks[seed.rarity] ?? 0,
      type: seed.type,
      weight: seed.weight,
      stack: seed.stack,
      sell: seed.sell,
      locations: seed.locations,
      image,
      recycle: seed.recycle,
      craftedFrom: recipesByResult.get(seed.name) ?? [],
      usedIn: usedInByItem.get(seed.name) ?? [],
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

  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    source: "ARC Raiders Wiki",
    sourceUrl: "https://arcraiders.wiki",
    counts: {
      items: items.length,
      recycling: recyclingRows.length + weaponYieldCount,
      crafting: craftingRows.length + weaponRecipeCount,
      unknownOutputs: unknownOutputs.size,
    },
    unknownOutputs: [...unknownOutputs].sort(),
    items,
  };

  const readExistingCatalog = async (): Promise<Record<string, unknown> | null> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(DATA_FILE, "utf8"));
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const previous = await readExistingCatalog();
  const previousGeneratedAt = previous?.generatedAt;
  if (typeof previousGeneratedAt === "string" && previous) {
    const comparable = (value: Record<string, unknown>) =>
      JSON.stringify({ ...value, generatedAt: undefined });
    if (comparable(previous) === comparable({ ...catalog })) {
      catalog.generatedAt = previousGeneratedAt;
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

const packageJson = readRecord(JSON.parse(await readFile("package.json", "utf8")), "package.json");
console.info(`${readString(packageJson, "name", "package.json")}: syncing game data`);
await main();
