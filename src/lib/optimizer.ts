import { catalog, itemByRecipeName, itemsById, itemsByName, type CatalogItem } from "./catalog";
import type { ItemId } from "./catalog-types";

export type InventoryLine = { id: ItemId; qty: number };
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

export type Goal = { id: ItemId; qty: number };
export type GoalMode = "component" | "craft";

export type GoalReservation = {
  item: CatalogItem;
  keepQty: number;
  produced: number;
  bonus: { name: string; qty: number }[];
  reason: string;
};

export type GoalMissing = {
  name: string;
  qty: number;
};

export type GoalPlan = {
  goalId: string;
  item: CatalogItem;
  needed: number;
  covered: number;
  gap: number;
  mode: GoalMode;
  ready: boolean;
  missing: GoalMissing[];
  sourcePotential: number;
  sourceCovered: number;
  directKept: number;
  reservations: GoalReservation[];
};

export type KeepEntry = { qty: number; reasons: string[] };

export type RetentionPlan = {
  goals: GoalPlan[];
  keepById: Record<string, KeepEntry>;
  surplusUnits: number;
  surplusValue: number;
  coveredGoals: number;
  reservedLines: number;
};

export const slotsFor = (qty: number, stack: number): number =>
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

export const recommendSurplus = (stats: LineStats): Recommendation => {
  if (stats.recycleValue > stats.sellValue * 1.08 && stats.recycleValue > 0) {
    const gain = stats.recycleValue - stats.sellValue;
    return {
      kind: "recycle",
      label: "Recycler",
      value: stats.recycleValue,
      detail: `Recyclage ${formatCredits(stats.recycleValue)} CR contre ${formatCredits(stats.sellValue)} CR à la vente (+${formatCredits(gain)} CR).`,
    };
  }

  if (stats.sellValue > 0) {
    const gain = stats.sellValue - stats.recycleValue;
    return {
      kind: "sell",
      label: "Vendre",
      value: stats.sellValue,
      detail: `Vente ${formatCredits(stats.sellValue)} CR contre ${formatCredits(stats.recycleValue)} CR en recyclage${gain > 0 ? ` (+${formatCredits(gain)} CR)` : ""}.`,
    };
  }

  if (stats.recycleValue > 0) {
    return {
      kind: "recycle",
      label: "Recycler",
      value: stats.recycleValue,
      detail: "Aucune valeur de vente. Recyclage pour récupérer des matériaux.",
    };
  }

  return {
    kind: "keep",
    label: "Sans valeur",
    value: 0,
    detail: "Aucune valeur de vente ni de recyclage.",
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
  const ids = new Set<ItemId>();
  for (const item of catalog.items) {
    for (const name of Object.keys(item.recycle)) {
      const target = itemByRecipeName(name);
      if (target) ids.add(target.id);
    }
  }
  return [...ids]
    .map((id) => itemsById.get(id))
    .filter((item): item is CatalogItem => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
};

export const reverseSources = (targetId: ItemId): SourceOption[] => {
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

export const planTarget = (targetId: ItemId, needed: number): TargetPlan[] =>
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

export const retentionRecommendation = (stats: LineStats, keep: KeepEntry): Recommendation => {
  const surplusQty = Math.max(0, stats.qty - keep.qty);
  const reason = keep.reasons.join(" · ");

  if (surplusQty <= 0) {
    return {
      kind: "keep",
      label: "Garder",
      value: 0,
      detail: reason,
    };
  }

  const surplusStats = lineStats({ id: stats.item.id, qty: surplusQty });
  const disposal = surplusStats
    ? recommendSurplus(surplusStats)
    : { kind: "keep" as const, label: "Sans valeur", value: 0, detail: "" };

  if (disposal.kind === "keep") {
    return {
      kind: "keep",
      label: `Garder ${keep.qty}`,
      value: 0,
      detail: `${surplusQty} en surplus sans valeur. ${reason}`,
    };
  }

  return {
    kind: "keep",
    label: `Garder ${keep.qty} / ${disposal.kind === "sell" ? "vendre" : "recycler"}`,
    value: disposal.value,
    detail: `${surplusQty} en surplus → ${disposal.detail} ${reason}`,
  };
};

const componentGoalTypes = new Set([
  "Refined Material",
  "Basic Material",
  "Topside Material",
  "Recyclable",
  "Nature",
  "Ammunition",
]);

export const planRetention = (inventory: InventoryLine[], goals: Goal[]): RetentionPlan => {
  const available = new Map<ItemId, number>(inventory.map((line) => [line.id, line.qty]));
  const keepById: Record<ItemId, KeepEntry> = {};
  const lines = statsForLines(inventory);

  const addKeep = (id: ItemId, qty: number, reason: string) => {
    if (qty <= 0) return;
    const entry = keepById[id] ?? { qty: 0, reasons: [] };
    entry.qty += qty;
    entry.reasons.push(reason);
    keepById[id] = entry;
  };

  const goalPlans = goals.flatMap((goal): GoalPlan[] => {
    const item = itemsById.get(goal.id);
    if (!item || goal.qty <= 0) return [];

    const needed = Math.max(1, Math.floor(goal.qty));
    const mode: GoalMode = componentGoalTypes.has(item.type) ? "component" : "craft";
    const reservations: GoalReservation[] = [];
    const missing: GoalMissing[] = [];
    let sourcePotential = 0;
    let sourceCovered = 0;
    let directKept = 0;

    const addMissing = (name: string, qty: number) => {
      if (qty <= 0) return;
      const existing = missing.find((entry) => entry.name === name);
      if (existing) existing.qty += qty;
      else missing.push({ name, qty });
    };

    const reserveItem = (
      target: CatalogItem,
      qty: number,
      reason: string,
      produced = 0,
      bonus: { name: string; qty: number }[] = [],
    ): number => {
      const current = available.get(target.id) ?? 0;
      const take = Math.min(current, qty);
      if (take <= 0) return 0;
      available.set(target.id, current - take);
      addKeep(target.id, take, reason);
      const existing = reservations.find((entry) => entry.item.id === target.id);
      if (existing) {
        existing.keepQty += take;
        existing.produced += produced;
        existing.bonus.push(...bonus);
        existing.reason = `${existing.reason} · ${reason}`;
      } else {
        reservations.push({ item: target, keepQty: take, produced, bonus, reason });
      }
      return take;
    };

    type RequirementResolver = (
      requirement: CatalogItem,
      qty: number,
      purpose: string,
      depth: number,
      path: Set<string>,
    ) => void;

    let coverRequirement: RequirementResolver = () => {};

    const expandRecipe = (
      requirement: CatalogItem,
      qty: number,
      purpose: string,
      depth: number,
      path: Set<string>,
    ) => {
      const recipe = requirement.craftedFrom[0];
      if (!recipe || depth >= 8 || path.has(requirement.id)) {
        addMissing(requirement.name, qty);
        return;
      }

      const crafts = Math.ceil(qty / recipe.resultQty);
      const nextPath = new Set(path);
      nextPath.add(requirement.id);
      const pending: { item: CatalogItem; qty: number; purpose: string }[] = [];

      for (const ingredient of recipe.ingredients) {
        const ingredientItem = itemsByName.get(ingredient.item);
        const ingredientQty = ingredient.qty * crafts;
        if (!ingredientItem) {
          addMissing(ingredient.item, ingredientQty);
          continue;
        }
        const direct = reserveItem(
          ingredientItem,
          Math.min(available.get(ingredientItem.id) ?? 0, ingredientQty),
          `${Math.min(available.get(ingredientItem.id) ?? 0, ingredientQty)}× ${ingredientItem.name} pour ${crafts}× ${requirement.name}`,
        );
        if (ingredientQty - direct > 0) {
          pending.push({
            item: ingredientItem,
            qty: ingredientQty - direct,
            purpose: `${crafts}× ${requirement.name}`,
          });
        }
      }

      for (const item of pending) {
        coverRequirement(item.item, item.qty, item.purpose, depth + 1, nextPath);
      }
    };

    coverRequirement = (requirement, qty, purpose, depth, path) => {
      if (qty <= 0) return;

      const candidates = lines
        .flatMap((stats) => {
          if (stats.item.id === requirement.id) return [];
          const yieldQty = stats.item.recycle[requirement.name] ?? 0;
          const availableQty = available.get(stats.item.id) ?? 0;
          if (yieldQty <= 0 || availableQty <= 0) return [];
          return [{ stats, yieldQty, availableQty }];
        })
        .sort(
          (left, right) =>
            right.yieldQty * right.stats.item.stack - left.yieldQty * left.stats.item.stack,
        );

      let remaining = qty;
      const reserveSource = (candidate: (typeof candidates)[number]) => {
        if (remaining <= 0) return;
        const units = Math.min(candidate.availableQty, Math.ceil(remaining / candidate.yieldQty));
        if (units <= 0) return;
        const produced = units * candidate.yieldQty;
        const bonus = Object.entries(candidate.stats.item.recycle)
          .filter(([name]) => name !== requirement.name)
          .map(([name, qty]) => ({ name, qty }));
        const bonusText =
          bonus.length > 0
            ? ` · +${bonus.map((item) => `${item.qty}× ${item.name}`).join(", ")}`
            : "";
        reserveItem(
          candidate.stats.item,
          units,
          `${units}× ${candidate.stats.item.name} → ${produced}× ${requirement.name}${bonusText} (${purpose})`,
          produced,
          bonus,
        );
        remaining -= produced;
      };

      const efficientSources = candidates.filter(
        (candidate) => candidate.yieldQty * candidate.stats.item.stack >= requirement.stack,
      );
      const inefficientSources = candidates.filter(
        (candidate) => candidate.yieldQty * candidate.stats.item.stack < requirement.stack,
      );

      for (const candidate of efficientSources) reserveSource(candidate);

      if (remaining > 0) {
        const availableQty = available.get(requirement.id) ?? 0;
        const direct = reserveItem(
          requirement,
          Math.min(availableQty, remaining),
          `${Math.min(availableQty, remaining)}× ${requirement.name} pour ${purpose}`,
        );
        remaining -= direct;
      }

      for (const candidate of inefficientSources) reserveSource(candidate);
      if (remaining <= 0) return;

      if (requirement.craftedFrom[0]) {
        expandRecipe(requirement, remaining, purpose, depth, path);
        return;
      }

      addMissing(requirement.name, remaining);
    };

    if (mode === "component") {
      let remaining = needed;
      const candidates = lines
        .flatMap((stats) => {
          if (stats.item.id === goal.id) return [];
          const yieldQty = stats.item.recycle[item.name] ?? 0;
          const availableQty = available.get(stats.item.id) ?? 0;
          if (yieldQty <= 0 || availableQty <= 0) return [];
          return [{ stats, yieldQty, availableQty }];
        })
        .sort(
          (left, right) =>
            right.yieldQty * right.stats.item.stack - left.yieldQty * left.stats.item.stack,
        );

      sourcePotential = candidates.reduce(
        (total, candidate) => total + candidate.availableQty * candidate.yieldQty,
        0,
      );

      const reserveSource = (candidate: (typeof candidates)[number]) => {
        if (remaining <= 0) return;
        const units = Math.min(candidate.availableQty, Math.ceil(remaining / candidate.yieldQty));
        if (units <= 0) return;
        const produced = units * candidate.yieldQty;
        const bonus = Object.entries(candidate.stats.item.recycle)
          .filter(([name]) => name !== item.name)
          .map(([name, qty]) => ({ name, qty }));
        const bonusText =
          bonus.length > 0
            ? ` · +${bonus.map((entry) => `${entry.qty}× ${entry.name}`).join(", ")}`
            : "";
        reserveItem(
          candidate.stats.item,
          units,
          `${units}× ${candidate.stats.item.name} → ${produced}× ${item.name}${bonusText} (objectif ${needed}×)`,
          produced,
          bonus,
        );
        sourceCovered += produced;
        remaining -= produced;
      };

      const efficientSources = candidates.filter(
        (candidate) => candidate.yieldQty * candidate.stats.item.stack >= item.stack,
      );
      const inefficientSources = candidates.filter(
        (candidate) => candidate.yieldQty * candidate.stats.item.stack < item.stack,
      );

      for (const candidate of efficientSources) reserveSource(candidate);

      if (remaining > 0) {
        directKept = reserveItem(
          item,
          Math.min(available.get(goal.id) ?? 0, remaining),
          `${Math.min(available.get(goal.id) ?? 0, remaining)}× ${item.name} gardés pour compléter ${needed}×`,
        );
        remaining -= directKept;
      }

      for (const candidate of inefficientSources) reserveSource(candidate);

      if (remaining > 0) {
        coverRequirement(item, remaining, `objectif ${needed}× ${item.name}`, 1, new Set());
      }
    } else {
      directKept = reserveItem(
        item,
        Math.min(available.get(goal.id) ?? 0, needed),
        `${Math.min(available.get(goal.id) ?? 0, needed)}× ${item.name} déjà dans le stash`,
      );
      let remaining = needed - directKept;
      if (remaining > 0) {
        coverRequirement(item, remaining, `objectif ${needed}× ${item.name}`, 1, new Set());
        remaining = 0;
      }
    }

    const ready = missing.length === 0;
    const covered = ready
      ? needed
      : Math.min(needed, mode === "component" ? sourceCovered + directKept : directKept);

    return [
      {
        goalId: goal.id,
        item,
        needed,
        covered,
        gap: ready ? 0 : Math.max(0, needed - covered),
        mode,
        ready,
        missing,
        sourcePotential,
        sourceCovered,
        directKept,
        reservations,
      },
    ];
  });

  let surplusUnits = 0;
  let surplusValue = 0;
  for (const stats of lines) {
    const keepQty = keepById[stats.item.id]?.qty ?? 0;
    const surplusQty = Math.max(0, stats.qty - keepQty);
    if (surplusQty <= 0) continue;
    surplusUnits += surplusQty;
    const surplusStats = lineStats({ id: stats.item.id, qty: surplusQty });
    if (surplusStats) surplusValue += recommendSurplus(surplusStats).value;
  }

  return {
    goals: goalPlans,
    keepById,
    surplusUnits,
    surplusValue,
    coveredGoals: goalPlans.filter((goal) => goal.ready).length,
    reservedLines: Object.keys(keepById).length,
  };
};

export const formatCredits = (value: number): string => Math.round(value).toLocaleString("fr-FR");
