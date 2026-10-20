import type { LineStats } from "./line-stats";
import { lineStats } from "./line-stats";
import { RECYCLE_MARGIN } from "./constants";

export type ActionKind = "recycle" | "sell" | "keep";

export type Disposal = "sell" | "recycle";

export type KeepReason =
  | { kind: "crafting"; recipeCount: number }
  | { kind: "valueless" }
  | { kind: "objective"; qty: number; surplusQty: number; disposal: Disposal | null };

type RecommendationBase = {
  value: number;
  sellValue: number;
  recycleValue: number;
};

export type Recommendation =
  | (RecommendationBase & { kind: "sell" })
  | (RecommendationBase & { kind: "recycle" })
  | (RecommendationBase & { kind: "keep"; reason: KeepReason });

type RecommendOptions = { considerCrafting?: boolean };

export const recommend = (
  stats: LineStats,
  { considerCrafting = true }: RecommendOptions = {},
): Recommendation => {
  const { item, sellValue, recycleValue } = stats;
  const base = { sellValue, recycleValue };

  if (recycleValue > sellValue * RECYCLE_MARGIN && recycleValue > 0) {
    return { kind: "recycle", value: recycleValue, ...base };
  }

  if (considerCrafting && item.usedIn.length > 0 && item.rarityRank >= 2) {
    return {
      kind: "keep",
      value: Math.max(sellValue, recycleValue),
      reason: { kind: "crafting", recipeCount: item.usedIn.length },
      ...base,
    };
  }

  if (sellValue > 0) return { kind: "sell", value: sellValue, ...base };
  if (recycleValue > 0) return { kind: "recycle", value: recycleValue, ...base };

  return { kind: "keep", value: 0, reason: { kind: "valueless" }, ...base };
};

export const recommendSurplus = (stats: LineStats): Recommendation =>
  recommend(stats, { considerCrafting: false });

export const objectiveAdvice = (stats: LineStats, keepQty: number): Recommendation => {
  const surplusQty = Math.max(0, stats.qty - keepQty);
  const surplusStats = surplusQty > 0 ? lineStats({ id: stats.item.id, qty: surplusQty }) : null;
  const disposal = surplusStats ? recommendSurplus(surplusStats) : null;
  const disposalKind = disposal && disposal.kind !== "keep" ? disposal.kind : null;
  return {
    kind: "keep",
    value: disposal?.value ?? 0,
    sellValue: stats.sellValue,
    recycleValue: stats.recycleValue,
    reason: { kind: "objective", qty: keepQty, surplusQty, disposal: disposalKind },
  };
};
