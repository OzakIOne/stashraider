import { describe, expect, it } from "vitest";
import { toItemId } from "./catalog-types";
import { recommendationDetail, recommendationLabel } from "./copy";
import { formatCredits, lineStats } from "./line-stats";
import { objectiveAdvice, recommend } from "./recommend";

const entry = (id: string, qty: number) => ({ id: toItemId(id), qty });

const statsFor = (id: string, qty: number) => {
  const stats = lineStats(entry(id, qty));
  if (!stats) throw new Error(`Missing fixture item: ${id}`);
  return stats;
};

describe("recommendations", () => {
  it("recycles a Rocketeer Driver when the yield beats its sale price", () => {
    const stats = statsFor("rocketeer-driver", 3);
    expect(stats.recycleValue).toBe(12300);
    expect(stats.sellValue).toBe(9000);
    expect(recommend(stats).kind).toBe("recycle");
  });

  it("keeps Advanced Electrical Components for crafting", () => {
    const recommendation = recommend(statsFor("advanced-electrical-components", 5));
    expect(recommendation.kind).toBe("keep");
    expect(recommendationLabel(recommendation)).toBe("Garder");
    expect(recommendationDetail(recommendation)).toContain("recettes");
  });

  it("labels the split between kept and surplus units", () => {
    const recommendation = objectiveAdvice(statsFor("advanced-electrical-components", 12), 2);

    expect(recommendationLabel(recommendation)).toBe("Garder 2 / vendre");
    expect(recommendationDetail(recommendation)).toContain(formatCredits(17500));
  });

  it("keeps every unit when nothing is surplus", () => {
    const recommendation = objectiveAdvice(statsFor("advanced-electrical-components", 2), 2);

    expect(recommendationLabel(recommendation)).toBe("Garder 2");
    if (recommendation.kind !== "keep") throw new Error("expected a keep recommendation");
    expect(recommendation.reason).toEqual({
      kind: "objective",
      qty: 2,
      surplusQty: 0,
      disposal: null,
    });
  });
});
