import { describe, expect, it } from "vitest";
import { parseInventoryText } from "./inventory-import";

describe("inventory import", () => {
  it("reads quantity before or after the item name", () => {
    const result = parseInventoryText(
      ["12 Advanced Electrical Components", "Rocketeer Driver x4", "2x ARC Alloy"].join("\n"),
    );

    expect(result.lines).toEqual([
      { id: "advanced-electrical-components", qty: 12 },
      { id: "rocketeer-driver", qty: 4 },
      { id: "arc-alloy", qty: 2 },
    ]);
    expect(result.unknown).toEqual([]);
  });

  it("merges duplicates and reports unknown names", () => {
    const result = parseInventoryText(
      ["5 Processor", "2 Processor", "Random Item 3", "ARC Alloy 15"].join("\n"),
    );

    expect(result.lines).toContainEqual({ id: "processor", qty: 7 });
    expect(result.lines).toContainEqual({ id: "arc-alloy", qty: 15 });
    expect(result.unknown).toEqual(["Random Item"]);
  });

  it("defaults to one unit without a quantity", () => {
    expect(parseInventoryText("Rocketeer Driver").lines).toEqual([
      { id: "rocketeer-driver", qty: 1 },
    ]);
  });
});
