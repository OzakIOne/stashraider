import { describe, expect, it } from "vitest";
import { toItemId } from "./catalog-types";
import { planRetention } from "./retention";

const entry = (id: string, qty: number) => ({ id: toItemId(id), qty });

describe("objective retention", () => {
  it("keeps recyclable sources before direct components", () => {
    const plan = planRetention(
      [entry("advanced-electrical-components", 12), entry("rocketeer-driver", 4)],
      [entry("advanced-electrical-components", 10)],
    );

    expect(plan.keepById[toItemId("rocketeer-driver")]?.qty).toBe(4);
    expect(plan.keepById[toItemId("advanced-electrical-components")]?.qty).toBe(2);
    expect(plan.goals[0]?.covered).toBe(10);
    expect(plan.goals[0]?.gap).toBe(0);
    expect(plan.surplusUnits).toBe(10);
    expect(plan.surplusValue).toBe(17500);
  });

  it("reports the missing quantity when the stash cannot cover a goal", () => {
    const plan = planRetention(
      [entry("advanced-electrical-components", 3)],
      [entry("advanced-electrical-components", 5)],
    );

    expect(plan.keepById[toItemId("advanced-electrical-components")]?.qty).toBe(3);
    expect(plan.goals[0]?.gap).toBe(2);
    expect(plan.coveredGoals).toBe(0);
  });

  it("prefers direct components over lower-density sources", () => {
    const plan = planRetention(
      [entry("advanced-electrical-components", 12), entry("frequency-modulation-box", 2)],
      [entry("advanced-electrical-components", 10)],
    );

    expect(plan.keepById[toItemId("advanced-electrical-components")]?.qty).toBe(10);
    expect(plan.keepById[toItemId("frequency-modulation-box")]).toBeUndefined();
    expect(plan.surplusUnits).toBe(4);
  });

  it("records why a line is reserved", () => {
    const plan = planRetention(
      [entry("advanced-electrical-components", 12), entry("rocketeer-driver", 4)],
      [entry("advanced-electrical-components", 10)],
    );

    expect(plan.keepById[toItemId("rocketeer-driver")]?.reasons).toEqual([
      expect.objectContaining({
        kind: "recycle",
        output: "Advanced Electrical Components",
        produced: 8,
        bonus: [{ name: "ARC Alloy", qty: 3 }],
      }),
    ]);
    expect(plan.keepById[toItemId("advanced-electrical-components")]?.reasons).toEqual([
      expect.objectContaining({ kind: "direct", goalQty: 10 }),
    ]);
  });
});

describe("crafting goals", () => {
  it("reserves the ingredients for a Wolfpack", () => {
    const plan = planRetention(
      [
        entry("explosive-compound", 1),
        entry("arc-motion-core", 2),
        entry("rocketeer-driver", 1),
        entry("arc-alloy", 10),
      ],
      [entry("wolfpack", 1)],
    );

    expect(plan.goals[0]?.mode).toBe("craft");
    expect(plan.goals[0]?.ready).toBe(true);
    expect(plan.keepById[toItemId("explosive-compound")]?.qty).toBe(1);
    expect(plan.keepById[toItemId("arc-motion-core")]?.qty).toBe(2);
    expect(plan.keepById[toItemId("rocketeer-driver")]?.qty).toBe(1);
    expect(plan.surplusUnits).toBe(10);
  });

  it("reserves direct ingredients for a Venator I", () => {
    const plan = planRetention(
      [
        entry("advanced-mechanical-components", 2),
        entry("medium-gun-parts", 3),
        entry("magnet", 5),
      ],
      [entry("venator-i", 1)],
    );

    expect(plan.goals[0]?.mode).toBe("craft");
    expect(plan.goals[0]?.ready).toBe(true);
    expect(plan.keepById[toItemId("advanced-mechanical-components")]?.qty).toBe(2);
    expect(plan.keepById[toItemId("medium-gun-parts")]?.qty).toBe(3);
    expect(plan.keepById[toItemId("magnet")]?.qty).toBe(5);
  });

  it("expands a nested recipe when the component is missing", () => {
    const plan = planRetention(
      [
        entry("steel-spring", 4),
        entry("mechanical-components", 4),
        entry("medium-gun-parts", 3),
        entry("magnet", 5),
      ],
      [entry("venator-i", 1)],
    );

    expect(plan.goals[0]?.ready).toBe(true);
    expect(plan.keepById[toItemId("steel-spring")]?.qty).toBe(4);
    expect(plan.keepById[toItemId("mechanical-components")]?.qty).toBe(4);
  });

  it("walks the Venator upgrade chain back to Venator I", () => {
    const plan = planRetention(
      [
        entry("advanced-mechanical-components", 3),
        entry("medium-gun-parts", 5),
        entry("magnet", 5),
      ],
      [entry("venator-ii", 1)],
    );

    expect(plan.goals[0]?.ready).toBe(true);
    expect(plan.keepById[toItemId("advanced-mechanical-components")]?.qty).toBe(3);
    expect(plan.keepById[toItemId("medium-gun-parts")]?.qty).toBe(5);
    expect(plan.keepById[toItemId("magnet")]?.qty).toBe(5);
  });

  it("lists missing ingredients instead of pretending the craft is ready", () => {
    const plan = planRetention([entry("rocketeer-driver", 1)], [entry("wolfpack", 1)]);

    expect(plan.goals[0]?.ready).toBe(false);
    expect(plan.keepById[toItemId("rocketeer-driver")]?.qty).toBe(1);
    expect(plan.goals[0]?.missing).toEqual(
      expect.arrayContaining([
        { name: "Chemicals", qty: 12 },
        { name: "ARC Alloy", qty: 16 },
      ]),
    );
  });
});
