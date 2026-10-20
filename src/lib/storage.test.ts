import { describe, expect, it } from "vitest";
import { MAX_CAPACITY } from "./constants";
import { decodeCapacity, decodeGoals, decodeInventory, decodeValueMode } from "./storage";

describe("persisted values", () => {
  it("keeps valid lines and clamps their quantity", () => {
    const decoded = decodeInventory([
      { id: "rocketeer-driver", qty: 4 },
      { id: "arc-alloy", qty: 2.7 },
    ]);

    expect(decoded).toEqual([
      { id: "rocketeer-driver", qty: 4 },
      { id: "arc-alloy", qty: 2 },
    ]);
  });

  it("drops entries the catalog no longer knows", () => {
    expect(decodeInventory([{ id: "deleted-item", qty: 3 }])).toEqual([]);
  });

  it("rejects payloads that are not a list of entries", () => {
    expect(decodeInventory({ id: "arc-alloy", qty: 1 })).toBeNull();
    expect(decodeGoals("nope")).toBeNull();
  });

  it("clamps the stash capacity", () => {
    expect(decodeCapacity(MAX_CAPACITY * 4)).toBe(MAX_CAPACITY);
    expect(decodeCapacity(0)).toBe(1);
    expect(decodeCapacity("280")).toBeNull();
  });

  it("only accepts known value modes", () => {
    expect(decodeValueMode("recycle")).toBe("recycle");
    expect(decodeValueMode("salvage")).toBeNull();
  });
});
