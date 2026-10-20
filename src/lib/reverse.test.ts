import { describe, expect, it } from "vitest";
import { toItemId } from "./catalog-types";
import { planTarget, reverseSources } from "./reverse";

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
