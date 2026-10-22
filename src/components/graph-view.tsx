import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { MaximizeIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { typeLabel, type CatalogItem } from "@/lib/catalog";
import { toItemId, type ItemId } from "@/lib/catalog-types";
import { formatCredits } from "@/lib/line-stats";
import {
  buildRecycleGraph,
  connectedIds,
  isBaseMaterial,
  recycleGraph as catalogGraph,
  recycleProfile,
  type RecycleProfile,
} from "@/lib/recycle-graph";
import { foldText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { ItemIcon, Panel, RarityBadge } from "./ui";

const RARITY_COLORS: Record<string, string> = {
  Common: "#9ba7b6",
  Uncommon: "#5ee08d",
  Rare: "#49b8ff",
  Epic: "#b18cff",
  Legendary: "#ffc247",
  Amplified: "#ff7ad9",
};

type RecycleFlowNodeData = {
  item: CatalogItem;
  rarity: string;
  isSource: boolean;
  dimmed: boolean;
  focused: boolean;
  matched: boolean;
};

type RecycleFlowNode = Node<RecycleFlowNodeData, "recycle">;

const RecycleNode = ({ data }: NodeProps<RecycleFlowNode>) => (
  <>
    <Handle type="target" position={Position.Left} isConnectable={false} className="graph-handle" />
    <div
      className={cn(
        "flex h-full w-full items-center gap-1.5 rounded-md border bg-[#0c1016]/95 px-1.5 text-left transition-[opacity,border-color,background-color] duration-150",
        data.isSource ? "border-border" : "border-rarity-rare/30 bg-[#0a141b]/95",
        data.focused
          ? "border-primary bg-primary/15 ring-1 ring-primary/60"
          : "hover:border-primary/45",
        data.matched && "border-primary/60",
        data.dimmed && "opacity-20",
      )}
    >
      <ItemIcon item={data.item} size="xs" className="size-5 rounded text-[8px]" />
      <span className="min-w-0 flex-1 truncate text-[10.5px] leading-none">{data.item.name}</span>
      <span className="shrink-0 rounded border border-border bg-black/40 px-1 py-px text-[8.5px] tabular-nums text-muted-foreground">
        ×{data.item.stack}
      </span>
    </div>
    <Handle
      type="source"
      position={Position.Right}
      isConnectable={false}
      className="graph-handle"
    />
  </>
);

const nodeTypes = { recycle: RecycleNode };

const miniMapColor = (node: Node): string => {
  const rarity = node.data.rarity;
  return typeof rarity === "string" ? (RARITY_COLORS[rarity] ?? "#3b4a5e") : "#3b4a5e";
};

const FilterChip = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
      active
        ? "border-primary/45 bg-primary/10 text-primary"
        : "border-border text-muted-foreground line-through hover:border-input hover:text-foreground",
    )}
  >
    {label}
  </button>
);

export const GraphView = ({ onInspect }: { onInspect: (item: CatalogItem) => void }) => (
  <ReactFlowProvider>
    <GraphViewCanvas onInspect={onInspect} />
  </ReactFlowProvider>
);

const GraphViewCanvas = ({ onInspect }: { onInspect: (item: CatalogItem) => void }) => {
  const [showWeapons, setShowWeapons] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);
  const [selected, setSelected] = useState<ItemId | null>(null);
  const [hovered, setHovered] = useState<ItemId | null>(null);
  const [query, setQuery] = useState("");
  const [viewportWidth, setViewportWidth] = useState(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const { getViewport, setCenter, setViewport } = useReactFlow();

  const graph = useMemo(
    () =>
      showWeapons && showMaterials
        ? catalogGraph
        : buildRecycleGraph({ includeWeapons: showWeapons, includeMaterials: showMaterials }),
    [showWeapons, showMaterials],
  );
  const weaponCount = useMemo(
    () => catalogGraph.nodes.filter((node) => node.item.type === "Weapon").length,
    [],
  );
  const baseCount = useMemo(
    () => catalogGraph.nodes.filter((node) => isBaseMaterial(node.item)).length,
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setViewportWidth(canvas.clientWidth));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const fitWidth = useCallback(() => {
    if (viewportWidth === 0) return;
    const zoom = Math.min(1.1, Math.max(0.6, (viewportWidth - 32) / graph.width));
    void setViewport({ x: 16, y: 16, zoom }, { duration: 250 });
  }, [graph, viewportWidth, setViewport]);

  useEffect(() => {
    fitWidth();
  }, [fitWidth]);

  const profile = useMemo(
    () => (selected ? recycleProfile(selected, graph) : null),
    [selected, graph],
  );
  const focus = hovered ?? selected;
  const connected = useMemo(() => (focus ? connectedIds(graph, focus) : null), [graph, focus]);
  const needle = foldText(query.trim());
  const matches = useMemo(() => {
    if (!needle) return null;
    return new Set(
      graph.nodes
        .filter(
          (node) =>
            foldText(node.item.name).includes(needle) || foldText(node.item.type).includes(needle),
        )
        .map((node) => node.item.id),
    );
  }, [needle, graph]);

  useEffect(() => {
    if (!matches || matches.size === 0) return;
    const timeout = setTimeout(() => {
      const first = graph.nodes.find((node) => matches.has(node.item.id));
      if (!first) return;
      const zoom = Math.min(0.9, Math.max(0.6, getViewport().zoom));
      void setCenter(first.x + graph.nodeWidth / 2, first.y + graph.nodeHeight / 2, {
        zoom,
        duration: 400,
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [matches, graph, getViewport, setCenter]);

  useEffect(() => {
    if (selected && !graph.nodesById.has(selected)) setSelected(null);
    if (hovered && !graph.nodesById.has(hovered)) setHovered(null);
  }, [graph, selected, hovered]);

  const materials = useMemo(
    () =>
      graph.nodes
        .filter((node) => !node.isSource)
        .sort((left, right) => right.parentCount - left.parentCount),
    [graph],
  );

  const flowNodes = useMemo<RecycleFlowNode[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.item.id,
        type: "recycle",
        position: { x: node.x, y: node.y },
        width: graph.nodeWidth,
        height: graph.nodeHeight,
        style: { width: graph.nodeWidth, height: graph.nodeHeight },
        draggable: false,
        selectable: false,
        data: {
          item: node.item,
          rarity: node.item.rarity,
          isSource: node.isSource,
          dimmed:
            (connected !== null && !connected.has(node.item.id)) ||
            (matches !== null && !matches.has(node.item.id)),
          focused: focus === node.item.id,
          matched: matches === null || matches.has(node.item.id),
        },
      })),
    [graph, focus, connected, matches],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => {
        const from = edge.from.item.id;
        const to = edge.to.item.id;
        const focusEdge = focus !== null && (focus === from || focus === to);
        const searchEdge = matches !== null && matches.has(from) && matches.has(to);
        return {
          id: `${from}->${to}`,
          source: from,
          target: to,
          type: "default",
          selectable: false,
          focusable: false,
          label: focusEdge ? `×${edge.qtyPerItem} · ${edge.qtyPerStack}/stack` : undefined,
          labelShowBg: true,
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: "#06080b", fillOpacity: 0.9 },
          labelStyle: { fill: "#f5e6c8", fontSize: 10, fontWeight: 600 },
          style: {
            stroke: focusEdge
              ? "rgba(246,167,35,0.8)"
              : searchEdge
                ? "rgba(246,167,35,0.35)"
                : "rgba(148,163,184,0.16)",
            strokeWidth: focusEdge ? 1.6 : searchEdge ? 1.2 : 1,
            opacity:
              focus !== null && !focusEdge ? 0.18 : matches !== null && !searchEdge ? 0.35 : 1,
          },
        };
      }),
    [graph, focus, matches],
  );

  return (
    <Panel
      title="Graphe de recyclage"
      description="Tous les items recyclables, leur stack, et chaque matériau rendu au démontage"
      className="gap-0"
    >
      <div className="flex flex-wrap items-center gap-2 border-y border-border bg-black/20 px-3 py-2">
        <label className="relative flex min-w-[190px] flex-1 items-center">
          <SearchIcon className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
          <input
            id="graph-search"
            name="graph-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim().length === 0) fitWidth();
            }}
            placeholder="Chercher un item ou un matériau…"
            aria-label="Chercher dans le graphe"
            className="h-8 w-full rounded-md border border-input bg-black/40 pr-2 pl-7 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary/60"
          />
        </label>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {matches ? `${matches.size} / ${graph.nodes.length}` : `${graph.nodes.length} items`}
        </span>
        {selected ? (
          <Button variant="ghost" size="xs" onClick={() => setSelected(null)}>
            Tout voir
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            setQuery("");
            setSelected(null);
            fitWidth();
          }}
        >
          <MaximizeIcon /> Vue d'ensemble
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5">
        <span className="mr-1 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Afficher
        </span>
        <FilterChip
          active={showWeapons}
          label={`Armes (${weaponCount})`}
          onClick={() => setShowWeapons((current) => !current)}
        />
        <FilterChip
          active={showMaterials}
          label={`Matériaux de base (${baseCount})`}
          onClick={() => setShowMaterials((current) => !current)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> Item recyclable
        </span>
        {showMaterials ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rarity-rare" /> Matériau de base
          </span>
        ) : null}
        <span>Colonnes = profondeur de recyclage</span>
        <span>Badge ×N = stack de l'item</span>
        <span>Molette pour zoomer, glisser pour déplacer</span>
      </div>

      <div className="grid gap-3 px-3 pb-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div
          ref={canvasRef}
          className="graph-flow h-[64vh] min-h-[460px] overflow-hidden rounded-xl border border-border bg-[#06080b]"
        >
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelected(toItemId(node.id))}
            onNodeMouseEnter={(_, node) => setHovered(toItemId(node.id))}
            onNodeMouseLeave={() => setHovered(null)}
            onPaneClick={() => setSelected(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            elementsSelectable={false}
            minZoom={0.02}
            maxZoom={1.6}
            proOptions={{ hideAttribution: false }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="rgba(148,163,184,0.16)"
            />
            <Controls showInteractive={false} />
            <MiniMap
              className="hidden sm:block"
              position="bottom-right"
              style={{ bottom: 28 }}
              pannable
              zoomable
              nodeColor={miniMapColor}
              maskColor="rgba(6,8,11,0.72)"
            />
          </ReactFlow>
        </div>

        <aside className="grid content-start gap-2 rounded-xl border border-border bg-black/25 p-3 lg:max-h-[calc(64vh+2px)] lg:overflow-auto">
          {profile ? (
            <ProfileDetails profile={profile} onInspect={onInspect} />
          ) : (
            <>
              <section className="grid gap-1.5">
                <h3 className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
                  Comment lire
                </h3>
                <ul className="grid list-disc gap-1 pl-4 text-[11.5px] leading-relaxed text-muted-foreground">
                  <li>
                    Chaque colonne est un niveau : items recyclables à gauche, matériaux finaux à
                    droite.
                  </li>
                  <li>Le badge ×N est la taille de stack de l'item.</li>
                  <li>Survole un item pour isoler ses liens, clique pour le détail complet.</li>
                  <li>Les étiquettes apparaissent au survol : quantité par item et par stack.</li>
                  <li>Mini-carte en haut à droite pour naviguer dans les gros paquets.</li>
                </ul>
              </section>
              {materials.length > 0 ? (
                <section className="grid gap-1.5 border-t border-border pt-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    Matériaux les plus demandés
                  </h3>
                  {materials.slice(0, 8).map((node) => (
                    <button
                      key={node.item.id}
                      type="button"
                      onClick={() => setSelected(node.item.id)}
                      className="flex items-center gap-2 rounded-md border border-transparent px-1 py-1 text-left transition-colors hover:border-border hover:bg-white/[0.03]"
                    >
                      <ItemIcon item={node.item} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px]">
                        {node.item.name}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {node.parentCount} source{node.parentCount > 1 ? "s" : ""}
                      </span>
                    </button>
                  ))}
                </section>
              ) : null}
              <p className="border-t border-border pt-2 text-[10.5px] text-muted-foreground">
                {graph.sourceCount} items recyclables · {graph.materialCount} matériaux de base ·{" "}
                {graph.edges.length} liens. Les items sans rendement de recyclage ne sont pas
                affichés.
                {graph.unknownTargets.length > 0
                  ? ` Matériau sans fiche wiki ignoré : ${graph.unknownTargets.join(", ")}.`
                  : null}
              </p>
            </>
          )}
        </aside>
      </div>
    </Panel>
  );
};

const ProfileDetails = ({
  profile,
  onInspect,
}: {
  profile: RecycleProfile;
  onInspect: (item: CatalogItem) => void;
}) => (
  <>
    <header className="flex items-center gap-2.5">
      <ItemIcon item={profile.item} size="sm" />
      <div className="min-w-0">
        <strong className="block truncate text-[13px]">{profile.item.name}</strong>
        <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <RarityBadge item={profile.item} />
          {typeLabel(profile.item.type)}
        </span>
      </div>
    </header>

    <div className="grid grid-cols-2 gap-1.5">
      <div className="grid gap-px rounded-lg border border-border bg-black/30 p-2">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">Stack</span>
        <strong className="text-sm tabular-nums">{profile.item.stack}</strong>
      </div>
      <div className="grid gap-px rounded-lg border border-border bg-black/30 p-2">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
          Profondeur
        </span>
        <strong className="text-sm tabular-nums">{profile.depth}</strong>
      </div>
      <div className="grid gap-px rounded-lg border border-border bg-black/30 p-2">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
          Recyclage stack
        </span>
        <strong className="text-sm tabular-nums">{formatCredits(profile.stackValue)} CR</strong>
      </div>
      <div className="grid gap-px rounded-lg border border-border bg-black/30 p-2">
        <span className="text-[9px] tracking-wider text-muted-foreground uppercase">
          Vente stack
        </span>
        <strong className="text-sm tabular-nums">
          {formatCredits(profile.item.sell * profile.item.stack)} CR
        </strong>
      </div>
    </div>

    <section className="grid gap-1">
      <h3 className="text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
        Enfants recyclés ({profile.children.length})
      </h3>
      {profile.children.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Aucun rendement connu.</p>
      ) : (
        profile.children.map((child) => (
          <div
            key={child.item.id}
            className="flex items-center gap-2 rounded-md border border-border/70 bg-black/25 px-1.5 py-1"
          >
            <ItemIcon item={child.item} size="xs" className="size-5 rounded text-[8px]" />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[11px]">{child.item.name}</strong>
              <small className="text-[9.5px] text-muted-foreground">
                {formatCredits(child.value)} CR / stack · stack {child.item.stack}
              </small>
            </span>
            <span className="grid text-right">
              <strong className="text-[11px] tabular-nums text-primary">×{child.qtyPerItem}</strong>
              <small className="text-[9.5px] tabular-nums text-muted-foreground">
                {child.qtyPerStack} / stack
              </small>
            </span>
          </div>
        ))
      )}
    </section>

    <section className="grid gap-1 border-t border-border pt-2">
      <h3 className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        Sources recyclées ({profile.parents.length})
      </h3>
      {profile.parents.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Aucun item ne recycle vers celui-ci.</p>
      ) : (
        profile.parents.map((parent) => (
          <button
            key={parent.item.id}
            type="button"
            onClick={() => onInspect(parent.item)}
            className="flex items-center gap-2 rounded-md border border-transparent px-1 py-1 text-left transition-colors hover:border-border hover:bg-white/[0.03]"
          >
            <ItemIcon item={parent.item} size="xs" className="size-5 rounded text-[8px]" />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[11px]">{parent.item.name}</strong>
              <small className="text-[9.5px] text-muted-foreground">
                stack {parent.item.stack}
              </small>
            </span>
            <span className="grid text-right">
              <strong className="text-[11px] tabular-nums">×{parent.qtyPerItem}</strong>
              <small className="text-[9.5px] tabular-nums text-muted-foreground">
                {parent.qtyPerStack} / stack
              </small>
            </span>
          </button>
        ))
      )}
    </section>

    <Button variant="outline" size="sm" onClick={() => onInspect(profile.item)}>
      Voir la fiche complète
    </Button>
  </>
);
