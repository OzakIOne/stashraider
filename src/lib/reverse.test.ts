import { describe, expect, it } from "vitest";
import { toItemId } from "./catalog-types";
import { missingSourcePlans, planTarget, reverseSources } from "./reverse";

const advancedElectrical = toItemId("advanced-electrical-components");

describe("reverse lookup", () => {
  it("finds sources that recycle into Advanced Electrical Components", () => {
    const sources = reverseSources(advancedElectrical);
    const rocketeer = sources.find((source) => source.item.id === toItemId("rocketeer-driver"));
    expect(rocketeer?.outputQty).toBe(2);
    expect(rocketeer?.yieldPerSlot).toBe(6);
  });

  it("plans enough source items for a target quantity", () => {
    const plans = planTarget(advancedElectrical, 10);
    const rocketeer = plans.find((plan) => plan.item.id === toItemId("rocketeer-driver"));
    expect(rocketeer?.unitsNeeded).toBe(5);
    expect(rocketeer?.slotsNeeded).toBe(2);
    expect(rocketeer?.leftover).toBe(0);
  });
});

describe("missing ingredient sources", () => {
  it("suggests the cheapest recyclable sources for a missing ingredient", () => {
    const plans = missingSourcePlans("Oil", 5);

    expect(plans).toHaveLength(3);
    expect(plans[0]?.item.name).toBe("Coolant");
    expect(plans[0]?.unitsNeeded).toBe(3);
    expect(plans[0]?.slotsNeeded).toBe(1);
  });

  it("returns nothing when the ingredient has no recyclable source", () => {
    expect(missingSourcePlans("Unknown Item", 1)).toEqual([]);
    expect(missingSourcePlans("Oil", 0)).toEqual([]);
  });
});
