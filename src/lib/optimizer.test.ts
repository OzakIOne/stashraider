import { describe, expect, it } from "vitest";
import { itemsById } from "./catalog";
import {
  formatCredits,
  lineStats,
  outputValue,
  planRetention,
  planTarget,
  recommend,
  retentionRecommendation,
  reverseSources,
  slotsFor,
  totalSlots,
} from "./optimizer";

const item = (id: string) => {
  const found = itemsById.get(id);
  if (!found) throw new Error(`Missing fixture item: ${id}`);
  return found;
};

describe("space and value math", () => {
  it("rounds partial stacks up", () => {
    expect(slotsFor(11, 5)).toBe(3);
    expect(slotsFor(5, 5)).toBe(1);
    expect(slotsFor(0, 5)).toBe(0);
  });

  it("values a recycle batch from current wiki prices", () => {
    const advancedElectrical = item("advanced-electrical-components");
    expect(outputValue({ [advancedElectrical.name]: 2 })).toBe(3500);
  });

  it("counts slots across the whole stash", () => {
    expect(
      totalSlots([
        { id: "advanced-electrical-components", qty: 11 },
        { id: "rocketeer-driver", qty: 4 },
      ]),
    ).toBe(5);
  });

  it("does not carry salvage data", () => {
    expect("salvage" in item("rocketeer-driver")).toBe(false);
  });
});

describe("recommendations", () => {
  it("recycles a Rocketeer Driver when the yield beats its sale price", () => {
    const stats = lineStats({ id: "rocketeer-driver", qty: 3 });
    if (!stats) throw new Error("missing Rocketeer Driver");
    expect(stats.recycleValue).toBe(12300);
    expect(stats.sellValue).toBe(9000);
    expect(recommend(stats).kind).toBe("recycle");
  });

  it("keeps Advanced Electrical Components for crafting", () => {
    const stats = lineStats({ id: "advanced-electrical-components", qty: 5 });
    if (!stats) throw new Error("missing Advanced Electrical Components");
    expect(recommend(stats).kind).toBe("keep");
  });
});

describe("reverse lookup", () => {
  it("finds sources that recycle into Advanced Electrical Components", () => {
    const sources = reverseSources("advanced-electrical-components");
    const rocketeer = sources.find((source) => source.item.id === "rocketeer-driver");
    expect(rocketeer?.outputQty).toBe(2);
    expect(rocketeer?.yieldPerSlot).toBe(6);
  });

  it("plans enough source items for a target quantity", () => {
    const plans = planTarget("advanced-electrical-components", 10);
    const rocketeer = plans.find((plan) => plan.item.id === "rocketeer-driver");
    expect(rocketeer?.unitsNeeded).toBe(5);
    expect(rocketeer?.slotsNeeded).toBe(2);
    expect(rocketeer?.leftover).toBe(0);
  });
});

describe("objective retention", () => {
  it("keeps recyclable sources before direct components", () => {
    const plan = planRetention(
      [
        { id: "advanced-electrical-components", qty: 12 },
        { id: "rocketeer-driver", qty: 4 },
      ],
      [{ id: "advanced-electrical-components", qty: 10 }],
    );

    expect(plan.keepById["rocketeer-driver"]?.qty).toBe(4);
    expect(plan.keepById["advanced-electrical-components"]?.qty).toBe(2);
    expect(plan.goals[0]?.covered).toBe(10);
    expect(plan.goals[0]?.gap).toBe(0);
    expect(plan.surplusUnits).toBe(10);
    expect(plan.surplusValue).toBe(17500);
  });

  it("reports the missing quantity when the stash cannot cover a goal", () => {
    const plan = planRetention(
      [{ id: "advanced-electrical-components", qty: 3 }],
      [{ id: "advanced-electrical-components", qty: 5 }],
    );

    expect(plan.keepById["advanced-electrical-components"]?.qty).toBe(3);
    expect(plan.goals[0]?.gap).toBe(2);
    expect(plan.coveredGoals).toBe(0);
  });

  it("prefers direct components over lower-density sources", () => {
    const plan = planRetention(
      [
        { id: "advanced-electrical-components", qty: 12 },
        { id: "frequency-modulation-box", qty: 2 },
      ],
      [{ id: "advanced-electrical-components", qty: 10 }],
    );

    expect(plan.keepById["advanced-electrical-components"]?.qty).toBe(10);
    expect(plan.keepById["frequency-modulation-box"]).toBeUndefined();
    expect(plan.surplusUnits).toBe(4);
  });

  it("labels the split between kept and surplus units", () => {
    const stats = lineStats({ id: "advanced-electrical-components", qty: 12 });
    if (!stats) throw new Error("missing Advanced Electrical Components");
    const recommendation = retentionRecommendation(stats, {
      qty: 2,
      reasons: ["2× Advanced Electrical Components gardés pour compléter 10×"],
    });

    expect(recommendation.label).toBe("Garder 2 / vendre");
    expect(recommendation.detail).toContain(formatCredits(17500));
  });
});
