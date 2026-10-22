import { catalog, itemByRecipeName, itemsById, recycleEntries, type CatalogItem } from "./catalog";
import type { ItemId } from "./catalog-types";

const NODE_WIDTH = 196;
const NODE_HEIGHT = 30;
const ROW_GAP = 6;
const COLUMN_GAP = 252;
const PADDING = 20;
const ORDERING_PASSES = 4;

export type GraphFilters = {
  includeWeapons?: boolean;
  includeMaterials?: boolean;
};

export type GraphNode = {
  item: CatalogItem;
  depth: number;
  isSource: boolean;
  childCount: number;
  parentCount: number;
  x: number;
  y: number;
};

export type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
  qtyPerItem: number;
  qtyPerStack: number;
};

export type RecycleGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodesById: Map<ItemId, GraphNode>;
  width: number;
  height: number;
  maxDepth: number;
  sourceCount: number;
  materialCount: number;
  nodeWidth: number;
  nodeHeight: number;
  unknownTargets: string[];
};

export type RecycleYield = {
  item: CatalogItem;
  qtyPerItem: number;
  qtyPerStack: number;
};

export type RecycleProfile = {
  item: CatalogItem;
  depth: number;
  children: (RecycleYield & { value: number })[];
  parents: RecycleYield[];
  stackValue: number;
};

export const isBaseMaterial = (item: CatalogItem): boolean =>
  Object.keys(item.recycle).length === 0;

const isHidden = (item: CatalogItem, filters: Required<GraphFilters>): boolean =>
  (!filters.includeWeapons && item.type === "Weapon") ||
  (!filters.includeMaterials && isBaseMaterial(item));

const average = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);

const orderLayers = ({
  layers,
  maxDepth,
  childIds,
  parentIds,
}: {
  layers: Map<number, GraphNode[]>;
  maxDepth: number;
  childIds: Map<ItemId, ItemId[]>;
  parentIds: Map<ItemId, ItemId[]>;
}) => {
  const index = new Map<ItemId, number>();
  const refreshIndex = () => {
    for (const layer of layers.values()) {
      layer.forEach((node, position) => index.set(node.item.id, position));
    }
  };
  refreshIndex();

  for (let pass = 0; pass < ORDERING_PASSES; pass++) {
    const depths = [...layers.keys()].sort((left, right) =>
      pass % 2 === 0 ? right - left : left - right,
    );
    for (const depth of depths) {
      const layer = layers.get(depth);
      if (!layer || layer.length < 2) continue;
      const neighbours = depth < maxDepth ? parentIds : depth > 0 ? childIds : parentIds;
      const barycenter = new Map<ItemId, number>();
      layer.forEach((node) => {
        const ids = neighbours.get(node.item.id) ?? [];
        const positions = ids.flatMap((id) => {
          const position = index.get(id);
          return position === undefined ? [] : [position];
        });
        barycenter.set(
          node.item.id,
          positions.length > 0 ? average(positions) : (index.get(node.item.id) ?? 0),
        );
      });
      layer.sort(
        (left, right) =>
          (barycenter.get(left.item.id) ?? 0) - (barycenter.get(right.item.id) ?? 0) ||
          left.item.name.localeCompare(right.item.name, "fr"),
      );
      refreshIndex();
    }
  }
};

const depthFor = (
  item: CatalogItem,
  cache: Map<string, number>,
  visibleIds: Set<ItemId>,
  visiting: Set<string>,
): number => {
  const cached = cache.get(item.name);
  if (cached !== undefined) return cached;
  if (visiting.has(item.name)) return 0;
  visiting.add(item.name);
  let depth = 0;
  for (const name of Object.keys(item.recycle)) {
    const child = itemByRecipeName(name);
    if (!child || !visibleIds.has(child.id)) continue;
    depth = Math.max(depth, 1 + depthFor(child, cache, visibleIds, visiting));
  }
  visiting.delete(item.name);
  cache.set(item.name, depth);
  return depth;
};

export const buildRecycleGraph = (filters: GraphFilters = {}): RecycleGraph => {
  const resolved = {
    includeWeapons: filters.includeWeapons ?? true,
    includeMaterials: filters.includeMaterials ?? true,
  };
  const unknownTargets = new Set<string>();
  const sources = catalog.items.filter(
    (item) => Object.keys(item.recycle).length > 0 && !isHidden(item, resolved),
  );

  const nodesById = new Map<ItemId, GraphNode>();
  const register = (item: CatalogItem, isSource: boolean) => {
    const existing = nodesById.get(item.id);
    if (existing) {
      existing.isSource = existing.isSource || isSource;
      return existing;
    }
    const node: GraphNode = {
      item,
      depth: 0,
      isSource,
      childCount: Object.keys(item.recycle).length,
      parentCount: 0,
      x: 0,
      y: 0,
    };
    nodesById.set(item.id, node);
    return node;
  };

  for (const item of sources) register(item, true);
  for (const item of sources) {
    for (const name of Object.keys(item.recycle)) {
      const target = itemByRecipeName(name);
      if (!target) {
        unknownTargets.add(name);
        continue;
      }
      if (isHidden(target, resolved)) continue;
      register(target, false);
    }
  }

  const edges: GraphEdge[] = [];
  for (const item of sources) {
    const from = nodesById.get(item.id);
    if (!from) continue;
    for (const [name, qtyPerItem] of recycleEntries(item)) {
      const target = itemByRecipeName(name);
      const to = target ? nodesById.get(target.id) : undefined;
      if (!to) continue;
      edges.push({ from, to, qtyPerItem, qtyPerStack: qtyPerItem * item.stack });
    }
  }

  const visibleIds = new Set(nodesById.keys());
  const depths = new Map<string, number>();
  for (const node of nodesById.values()) {
    node.depth = depthFor(node.item, depths, visibleIds, new Set());
  }

  const childIds = new Map<ItemId, ItemId[]>();
  const parentIds = new Map<ItemId, ItemId[]>();
  for (const edge of edges) {
    childIds.set(edge.from.item.id, [...(childIds.get(edge.from.item.id) ?? []), edge.to.item.id]);
    parentIds.set(edge.to.item.id, [...(parentIds.get(edge.to.item.id) ?? []), edge.from.item.id]);
  }
  for (const [id, parents] of parentIds) {
    const node = nodesById.get(id);
    if (node) node.parentCount = parents.length;
  }

  const maxDepth = Math.max(0, ...[...nodesById.values()].map((node) => node.depth));
  const layers = new Map<number, GraphNode[]>();
  for (const node of nodesById.values()) {
    layers.set(node.depth, [...(layers.get(node.depth) ?? []), node]);
  }
  for (const layer of layers.values()) {
    layer.sort((left, right) => left.item.name.localeCompare(right.item.name, "fr"));
  }

  orderLayers({ layers, maxDepth, childIds, parentIds });

  const layerHeight = (count: number) => count * NODE_HEIGHT + Math.max(0, count - 1) * ROW_GAP;
  const maxLayerHeight = Math.max(
    0,
    ...[...layers.values()].map((layer) => layerHeight(layer.length)),
  );

  for (const [depth, layer] of layers) {
    const left = PADDING + (maxDepth - depth) * COLUMN_GAP;
    layer.forEach((node, position) => {
      node.x = left;
      node.y = PADDING + position * (NODE_HEIGHT + ROW_GAP);
    });
  }

  const nodes = [...nodesById.values()];
  return {
    nodes,
    edges,
    nodesById,
    width: PADDING * 2 + maxDepth * COLUMN_GAP + NODE_WIDTH,
    height: PADDING * 2 + maxLayerHeight,
    maxDepth,
    sourceCount: nodes.filter((node) => node.isSource).length,
    materialCount: nodes.filter((node) => !node.isSource).length,
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
    unknownTargets: [...unknownTargets].sort((left, right) => left.localeCompare(right, "fr")),
  };
};

export const recycleGraph = buildRecycleGraph();

export const recycleProfile = (
  itemId: ItemId,
  graph: RecycleGraph = recycleGraph,
): RecycleProfile | null => {
  const item = itemsById.get(itemId);
  if (!item) return null;
  const children = recycleEntries(item).flatMap(([name, qtyPerItem]) => {
    const child = itemByRecipeName(name);
    if (!child) return [];
    const qtyPerStack = qtyPerItem * item.stack;
    return [{ item: child, qtyPerItem, qtyPerStack, value: qtyPerStack * child.sell }];
  });
  const parents = catalog.items.flatMap((candidate) => {
    const qtyPerItem = candidate.recycle[item.name] ?? 0;
    if (qtyPerItem <= 0) return [];
    return [{ item: candidate, qtyPerItem, qtyPerStack: qtyPerItem * candidate.stack }];
  });
  return {
    item,
    depth: graph.nodesById.get(itemId)?.depth ?? 0,
    children: children.sort((left, right) => right.qtyPerItem - left.qtyPerItem),
    parents: parents.sort((left, right) => right.qtyPerItem - left.qtyPerItem),
    stackValue: children.reduce((total, child) => total + child.value, 0),
  };
};

export const connectedIds = (graph: RecycleGraph, itemId: ItemId): Set<ItemId> => {
  const ids = new Set<ItemId>([itemId]);
  for (const edge of graph.edges) {
    if (edge.from.item.id === itemId) ids.add(edge.to.item.id);
    if (edge.to.item.id === itemId) ids.add(edge.from.item.id);
  }
  return ids;
};
