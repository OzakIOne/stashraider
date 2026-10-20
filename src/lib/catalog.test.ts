import { describe, expect, it } from "vitest";
import { catalog, itemsById, parseCatalog } from "./catalog";

describe("catalog boundary", () => {
  it("parses the generated artifact", () => {
    expect(catalog.items.length).toBe(catalog.counts.items);
  });

  it("keeps every id unique and resolvable", () => {
    const ids = catalog.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(itemsById.get(id)?.id).toBe(id);
  });

  it("resolves every recycling output except the declared unknowns", () => {
    const known = new Set<string>(catalog.items.map((item) => item.name));
    for (const item of catalog.items) {
      for (const output of Object.keys(item.recycle)) {
        expect(known.has(output) || catalog.unknownOutputs.includes(output)).toBe(true);
      }
    }
  });

  it("rejects a payload that is not a catalog", () => {
    expect(() => parseCatalog({})).toThrow(/catalog/);
    expect(() => parseCatalog({ ...catalog, items: [{}] })).toThrow(/catalog\.items\[0\]/);
  });
});
