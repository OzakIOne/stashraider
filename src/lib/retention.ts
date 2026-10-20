import { itemsById, itemsByName, type CatalogItem } from "./catalog";
import type { ItemId, ItemName } from "./catalog-types";
import { MAX_RECIPE_DEPTH } from "./constants";
import { lineStats, statsForLines, type InventoryLine, type LineStats } from "./line-stats";
import { recommendSurplus } from "./recommend";

export type Goal = { id: ItemId; qty: number };
export type GoalMode = "component" | "craft";

export type ObjectiveReason =
  | { kind: "direct"; goal: ItemName; goalQty: number }
  | { kind: "ingredient"; craft: ItemName }
  | {
      kind: "recycle";
      output: ItemName;
      produced: number;
      bonus: { name: string; qty: number }[];
    };

export type GoalReservation = {
  item: CatalogItem;
  keepQty: number;
  produced: number;
  bonus: { name: string; qty: number }[];
  reasons: ObjectiveReason[];
};

export type GoalMissing = {
  name: ItemName;
  qty: number;
};

export type GoalPlan = {
  goalId: ItemId;
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

export type KeepEntry = { qty: number; reasons: ObjectiveReason[] };

export type RetentionPlan = {
  goals: GoalPlan[];
  keepById: Record<ItemId, KeepEntry>;
  surplusUnits: number;
  surplusValue: number;
  coveredGoals: number;
  reservedLines: number;
};

const componentGoalTypes = new Set([
  "Refined Material",
  "Basic Material",
  "Topside Material",
  "Recyclable",
  "Nature",
  "Ammunition",
]);

type SourceCandidate = { stats: LineStats; yieldQty: number; availableQty: number };

type SourceReservation = {
  units: number;
  produced: number;
  bonus: { name: string; qty: number }[];
};

const sourceCandidates = (
  lines: LineStats[],
  available: Map<ItemId, number>,
  requirement: CatalogItem,
): SourceCandidate[] =>
  lines
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

const splitByDensity = (candidates: SourceCandidate[], requirement: CatalogItem) => {
  const efficient: SourceCandidate[] = [];
  const inefficient: SourceCandidate[] = [];
  for (const candidate of candidates) {
    const perFullSlot = candidate.yieldQty * candidate.stats.item.stack;
    (perFullSlot >= requirement.stack ? efficient : inefficient).push(candidate);
  }
  return { efficient, inefficient };
};

const reservationFor = (
  candidate: SourceCandidate,
  remaining: number,
  output: ItemName,
): SourceReservation | null => {
  const units = Math.min(candidate.availableQty, Math.ceil(remaining / candidate.yieldQty));
  if (units <= 0) return null;
  return {
    units,
    produced: units * candidate.yieldQty,
    bonus: Object.entries(candidate.stats.item.recycle)
      .filter(([name]) => name !== output)
      .map(([name, qty]) => ({ name, qty })),
  };
};

export const planRetention = (inventory: InventoryLine[], goals: Goal[]): RetentionPlan => {
  const available = new Map<ItemId, number>(inventory.map((line) => [line.id, line.qty]));
  const keepById: Record<ItemId, KeepEntry> = {};
  const lines = statsForLines(inventory);

  const addKeep = (id: ItemId, qty: number, reason: ObjectiveReason) => {
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

    const addMissing = (name: ItemName, qty: number) => {
      if (qty <= 0) return;
      const existing = missing.find((entry) => entry.name === name);
      if (existing) existing.qty += qty;
      else missing.push({ name, qty });
    };

    const reserveItem = (
      target: CatalogItem,
      qty: number,
      reason: ObjectiveReason,
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
        existing.reasons.push(reason);
      } else {
        reservations.push({ item: target, keepQty: take, produced, bonus, reasons: [reason] });
      }
      return take;
    };

    const directReason = (): ObjectiveReason => ({
      kind: "direct",
      goal: item.name,
      goalQty: needed,
    });

    const reserveSources = (
      candidates: SourceCandidate[],
      requirement: CatalogItem,
      remaining: number,
      onProduced?: (produced: number) => void,
    ): number => {
      let left = remaining;
      for (const candidate of candidates) {
        if (left <= 0) break;
        const reservation = reservationFor(candidate, left, requirement.name);
        if (!reservation) continue;
        reserveItem(
          candidate.stats.item,
          reservation.units,
          {
            kind: "recycle",
            output: requirement.name,
            produced: reservation.produced,
            bonus: reservation.bonus,
          },
          reservation.produced,
          reservation.bonus,
        );
        onProduced?.(reservation.produced);
        left -= reservation.produced;
      }
      return left;
    };

    const coverWithSources = (requirement: CatalogItem, quantity: number): number => {
      const candidates = sourceCandidates(lines, available, requirement);
      const { efficient, inefficient } = splitByDensity(candidates, requirement);
      let left = reserveSources(efficient, requirement, quantity);
      if (left > 0) {
        const stored = available.get(requirement.id) ?? 0;
        left -= reserveItem(requirement, Math.min(stored, left), directReason());
      }
      return reserveSources(inefficient, requirement, left);
    };

    const resolve = (
      requirement: CatalogItem,
      quantity: number,
      depth: number,
      path: Set<ItemId>,
    ): void => {
      if (quantity <= 0) return;
      const remaining = coverWithSources(requirement, quantity);
      if (remaining <= 0) return;

      const recipe = requirement.craftedFrom[0];
      if (!recipe || depth >= MAX_RECIPE_DEPTH || path.has(requirement.id)) {
        addMissing(requirement.name, remaining);
        return;
      }

      const crafts = Math.ceil(remaining / recipe.resultQty);
      const nextPath = new Set(path);
      nextPath.add(requirement.id);
      const pending: { item: CatalogItem; qty: number }[] = [];

      for (const ingredient of recipe.ingredients) {
        const ingredientItem = itemsByName.get(ingredient.item);
        const ingredientQty = ingredient.qty * crafts;
        if (!ingredientItem) {
          addMissing(ingredient.item, ingredientQty);
          continue;
        }
        const stored = Math.min(available.get(ingredientItem.id) ?? 0, ingredientQty);
        const direct = reserveItem(ingredientItem, stored, {
          kind: "ingredient",
          craft: requirement.name,
        });
        if (ingredientQty - direct > 0) {
          pending.push({ item: ingredientItem, qty: ingredientQty - direct });
        }
      }

      for (const entry of pending) resolve(entry.item, entry.qty, depth + 1, nextPath);
    };

    if (mode === "component") {
      const candidates = sourceCandidates(lines, available, item);
      sourcePotential = candidates.reduce(
        (total, candidate) => total + candidate.availableQty * candidate.yieldQty,
        0,
      );
      const { efficient, inefficient } = splitByDensity(candidates, item);
      let remaining = reserveSources(efficient, item, needed, (produced) => {
        sourceCovered += produced;
      });
      if (remaining > 0) {
        directKept = reserveItem(
          item,
          Math.min(available.get(goal.id) ?? 0, remaining),
          directReason(),
        );
        remaining -= directKept;
      }
      remaining = reserveSources(inefficient, item, remaining, (produced) => {
        sourceCovered += produced;
      });
      if (remaining > 0) resolve(item, remaining, 1, new Set());
    } else {
      directKept = reserveItem(item, Math.min(available.get(goal.id) ?? 0, needed), directReason());
      const remaining = needed - directKept;
      if (remaining > 0) resolve(item, remaining, 1, new Set());
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
