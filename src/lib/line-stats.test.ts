import { describe, expect, it } from "vitest";
import { itemsById } from "./catalog";
import { toItemId } from "./catalog-types";
import { outputValue, slotsFor, totalSlots } from "./line-stats";

const item = (id: string) => {
  const found = itemsById.get(toItemId(id));
  if (!found) throw new Error(`Missing fixture item: ${id}`);
  return found;
};

const entry = (id: string, qty: number) => ({ id: toItemId(id), qty });

describe("space and value math", () => {
  it("rounds partial stacks up", () => {
    expect(slotsFor({ qty: 11, stack: 5 })).toBe(3);
    expect(slotsFor({ qty: 5, stack: 5 })).toBe(1);
    expect(slotsFor({ qty: 0, stack: 5 })).toBe(0);
  });

  it("values a recycle batch from current wiki prices", () => {
    const advancedElectrical = item("advanced-electrical-components");
    expect(outputValue({ [advancedElectrical.name]: 2 })).toBe(3500);
  });

  it("counts slots across the whole stash", () => {
    expect(
      totalSlots([entry("advanced-electrical-components", 11), entry("rocketeer-driver", 4)]),
    ).toBe(5);
  });

  it("does not carry salvage data", () => {
    expect("salvage" in item("rocketeer-driver")).toBe(false);
  });
});
