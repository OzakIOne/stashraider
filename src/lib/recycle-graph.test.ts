import { describe, expect, it } from "vitest";
import { catalog } from "./catalog";
import { toItemId } from "./catalog-types";
import { buildRecycleGraph, recycleGraph, recycleProfile } from "./recycle-graph";

const rocketeer = toItemId("rocketeer-driver");
const advancedElectrical = toItemId("advanced-electrical-components");
const metalParts = toItemId("metal-parts");

describe("recycle graph", () => {
  it("keeps every recyclable item and every material in the graph", () => {
    const sourceCount = catalog.items.filter((item) => Object.keys(item.recycle).length > 0).length;
    const materialCount = catalog.items.filter(
      (item) =>
        Object.keys(item.recycle).length === 0 &&
        catalog.items.some((candidate) => candidate.recycle[item.name] !== undefined),
    ).length;

    expect(recycleGraph.sourceCount).toBe(sourceCount);
    expect(recycleGraph.materialCount).toBe(materialCount);
    expect(recycleGraph.nodesById.get(rocketeer)?.isSource).toBe(true);
    expect(recycleGraph.nodesById.get(metalParts)?.isSource).toBe(false);
  });

  it("never loops: every edge goes one layer down", () => {
    for (const edge of recycleGraph.edges) {
      expect(edge.from.depth).toBeGreaterThan(edge.to.depth);
    }
  });

  it("fills the canvas and orders layers from recyclable items to materials", () => {
    for (const node of recycleGraph.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.x + recycleGraph.nodeWidth).toBeLessThanOrEqual(recycleGraph.width);
      expect(node.y + recycleGraph.nodeHeight).toBeLessThanOrEqual(recycleGraph.height);
    }

    const deepest = recycleGraph.nodes.find((node) => node.depth === recycleGraph.maxDepth);
    const material = recycleGraph.nodes.find((node) => node.depth === 0);
    expect(deepest && material && deepest.x < material.x).toBe(true);
  });

  it("scales each yield by the parent stack", () => {
    const edge = recycleGraph.edges.find(
      (candidate) =>
        candidate.from.item.id === rocketeer && candidate.to.item.id === advancedElectrical,
    );

    expect(edge?.qtyPerItem).toBe(2);
    expect(edge?.qtyPerStack).toBe(2 * 3);
  });
});

describe("recycle graph filters", () => {
  it("removes weapons and their edges", () => {
    const filtered = buildRecycleGraph({ includeWeapons: false });

    expect(filtered.nodes.every((node) => node.item.type !== "Weapon")).toBe(true);
    expect(
      filtered.edges.every(
        (edge) => edge.from.item.type !== "Weapon" && edge.to.item.type !== "Weapon",
      ),
    ).toBe(true);
    expect(filtered.nodes.length).toBeLessThan(recycleGraph.nodes.length);
  });

  it("removes base materials and promotes their parents to the last column", () => {
    const filtered = buildRecycleGraph({ includeMaterials: false });
    const wires = filtered.nodesById.get(toItemId("wires"));

    expect(filtered.nodes.every((node) => Object.keys(node.item.recycle).length > 0)).toBe(true);
    expect(filtered.materialCount).toBe(0);
    expect(wires?.depth).toBe(0);
    expect(filtered.edges.every((edge) => edge.from.depth > edge.to.depth)).toBe(true);
  });

  it("combines both filters and recomputes the layout width", () => {
    const filtered = buildRecycleGraph({ includeWeapons: false, includeMaterials: false });

    expect(filtered.nodes.every((node) => node.item.type !== "Weapon")).toBe(true);
    expect(filtered.materialCount).toBe(0);
    expect(filtered.width).toBeLessThan(recycleGraph.width);
    expect(recycleProfile(advancedElectrical, filtered)?.depth).toBe(1);
  });
});

describe("recycle profile", () => {
  it("lists the children of an item", () => {
    const profile = recycleProfile(rocketeer);

    expect(profile?.children.map((child) => child.item.name)).toEqual([
      "ARC Alloy",
      "Advanced Electrical Components",
    ]);
    expect(profile?.children[1]?.qtyPerStack).toBe(6);
  });

  it("lists the items that recycle into a material", () => {
    const profile = recycleProfile(advancedElectrical);
    const names = profile?.parents.map((parent) => parent.item.name) ?? [];

    expect(names).toContain("Rocketeer Driver");
    expect(names).toContain("Glitched ARC Light Ring");
    expect(profile?.stackValue).toBeGreaterThan(0);
  });

  it("returns nothing for an unknown item", () => {
    expect(recycleProfile(toItemId("not-an-item"))).toBeNull();
  });
});
