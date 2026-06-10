import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  Brain,
  Database,
  HardDrive,
  Radio,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "./ui";
import { cx } from "./uiConfig";

const typeIcons = {
  source: Radio,
  api: Server,
  analysis: Brain,
  storage: HardDrive,
  persistence: Database,
  consumer: ShieldCheck,
};

// SVG stroke colors for edges (Tailwind classes don't apply to SVG strokes).
const STATUS_COLOR = {
  healthy: "#10b981", // emerald-500
  degraded: "#f59e0b", // amber-500
  down: "#ef4444", // red-500
  unknown: "#94a3b8", // slate-400
};

// Full literal ring/text classes so Tailwind keeps them at build time.
const NODE_RING = {
  healthy: "border-emerald-400 ring-emerald-100",
  degraded: "border-amber-400 ring-amber-100",
  down: "border-red-400 ring-red-100",
  unknown: "border-slate-300 ring-slate-100",
};

const DOT = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-slate-400",
};

const BADGE_TONE = { healthy: "emerald", degraded: "amber", down: "red", unknown: "neutral" };

// Left -> right pipeline tiers, positioned by node id.
const POSITIONS = {
  "agent-4chan": { x: 0, y: 210 },
  "inject-api": { x: 320, y: 210 },
  "ai-analysis": { x: 640, y: 70 },
  phash: { x: 640, y: 350 },
  storage: { x: 960, y: 70 },
  database: { x: 960, y: 350 },
  dashboard: { x: 1280, y: 70 },
  gateway: { x: 1280, y: 350 },
};

function statusKey(status) {
  return STATUS_COLOR[status] ? status : "unknown";
}

// Fallback layout for any node id not in POSITIONS: stack them in a left column.
function positionFor(id, index) {
  if (POSITIONS[id]) return POSITIONS[id];
  return { x: -300, y: 40 + index * 150 };
}

function PipelineNode({ data, selected }) {
  const key = statusKey(data.status);
  const Icon = typeIcons[data.type] || Activity;
  return (
    <div className="flex w-[150px] flex-col items-center">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-300" />
      <div
        className={cx(
          "relative flex h-24 w-24 items-center justify-center rounded-full border-4 bg-white shadow-sm ring-[6px] transition",
          NODE_RING[key],
          selected && "scale-110 shadow-md",
        )}
      >
        <Icon className="h-9 w-9 text-slate-700" aria-hidden="true" />
        <span className={cx("absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white", DOT[key])} />
      </div>
      <p className="mt-3 max-w-[150px] truncate text-center text-sm font-bold text-slate-900">{data.label}</p>
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{data.nodeType}</p>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-300" />
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNode };

function DetailOverlay({ node, onClose }) {
  if (!node) return null;
  const entries = Object.entries(node.metrics || {});
  return (
    <div className="absolute right-3 top-3 z-10 w-72 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{node.label}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{node.type}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2">
        <Badge tone={BADGE_TONE[statusKey(node.status)]}>{node.status || "unknown"}</Badge>
      </div>
      {node.details && <p className="mt-2 text-xs leading-relaxed text-slate-600">{node.details}</p>}
      {entries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entries.slice(0, 10).map(([k, v]) => (
            <span key={k} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
              <span className="text-slate-400">{k.replaceAll("_", " ")}:</span> {String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DataflowGraph({ nodes = [], edges = [], height = 500 }) {
  const [selectedId, setSelectedId] = useState(null);

  const rfNodes = useMemo(
    () =>
      nodes.map((node, index) => ({
        id: node.id,
        type: "pipeline",
        position: positionFor(node.id, index),
        data: {
          label: node.label,
          nodeType: node.type,
          type: node.type,
          status: node.status,
        },
        draggable: true,
      })),
    [nodes],
  );

  const rfEdges = useMemo(
    () =>
      edges.map((edge) => {
        const color = STATUS_COLOR[statusKey(edge.status)];
        return {
          id: `${edge.from}-${edge.to}`,
          source: edge.from,
          target: edge.to,
          label: edge.label,
          animated: edge.status === "healthy",
          style: { stroke: color, strokeWidth: 1.75 },
          labelStyle: { fill: "#64748b", fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        };
      }),
    [edges],
  );

  const onNodeClick = useCallback((_event, node) => setSelectedId(node.id), []);
  const onPaneClick = useCallback(() => setSelectedId(null), []);

  // Resolves to null automatically if the selected node leaves the data.
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) || null,
    [nodes, selectedId],
  );

  const styledNodes = useMemo(
    () => rfNodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [rfNodes, selectedId],
  );

  return (
    <div className="relative" style={{ height }}>
      <ReactFlow
        nodes={styledNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.75}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#cbd5e1" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <DetailOverlay node={selectedNode} onClose={() => setSelectedId(null)} />
    </div>
  );
}
