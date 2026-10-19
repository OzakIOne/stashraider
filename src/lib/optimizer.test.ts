import { describe, expect, it } from "vitest";
import { itemsById } from "./catalog";
import {
  lineStats,
  outputValue,
  planTarget,
  recommend,
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
    const sources = reverseSources("advanced-electrical-components", "recycle");
    const rocketeer = sources.find((source) => source.item.id === "rocketeer-driver");
    expect(rocketeer?.outputQty).toBe(2);
    expect(rocketeer?.yieldPerSlot).toBe(6);
  });

  it("plans enough source items for a target quantity", () => {
    const plans = planTarget("advanced-electrical-components", "recycle", 10);
    const rocketeer = plans.find((plan) => plan.item.id === "rocketeer-driver");
    expect(rocketeer?.unitsNeeded).toBe(5);
    expect(rocketeer?.slotsNeeded).toBe(2);
    expect(rocketeer?.leftover).toBe(0);
  });
});
