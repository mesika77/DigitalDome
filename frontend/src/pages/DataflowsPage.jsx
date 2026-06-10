import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  CircleSlash,
  Database,
  Gauge,
  HardDrive,
  LayoutGrid,
  Network,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import AppShell from "../components/AppShell";
import DataflowGraph from "../components/DataflowGraph";
import { getDataflowStatus } from "../api/client";
import {
  Badge,
  Button,
  EmptyState,
  InlineAlert,
  Panel,
  PanelHeader,
  Spinner,
  StatTile,
} from "../components/ui";
import { cx } from "../components/uiConfig";

const statusStyles = {
  healthy: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    ring: "border-emerald-200 bg-emerald-50",
    line: "bg-emerald-500",
    tone: "emerald",
    icon: CheckCircle2,
  },
  degraded: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    ring: "border-amber-200 bg-amber-50",
    line: "bg-amber-500",
    tone: "amber",
    icon: AlertTriangle,
  },
  down: {
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
    ring: "border-red-200 bg-red-50",
    line: "bg-red-500",
    tone: "red",
    icon: CircleSlash,
  },
};

const typeIcons = {
  source: Radio,
  api: Server,
  analysis: Brain,
  storage: HardDrive,
  persistence: Database,
  consumer: ShieldCheck,
};

const nodeOrder = [
  "agent-4chan",
  "inject-api",
  "ai-analysis",
  "phash",
  "storage",
  "database",
  "dashboard",
  "gateway",
];

function statusConfig(status) {
  return statusStyles[status] || statusStyles.degraded;
}

function StatusPill({ status }) {
  const config = statusConfig(status);
  const Icon = config.icon;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide", config.badge)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {status || "unknown"}
    </span>
  );
}

function formatTime(value) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return "never";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function MetricList({ metrics }) {
  const entries = Object.entries(metrics || {});
  if (entries.length === 0) return <span className="text-xs text-slate-400">No metrics</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.slice(0, 8).map(([key, value]) => (
        <span key={key} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <span className="text-slate-400">{key.replaceAll("_", " ")}:</span> {String(value)}
        </span>
      ))}
    </div>
  );
}

function NodeCard({ node }) {
  const config = statusConfig(node.status);
  const Icon = typeIcons[node.type] || Activity;
  return (
    <div className={cx("min-h-[154px] rounded-xl border bg-white p-4 shadow-sm", config.ring)}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white text-slate-800 shadow-sm">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <StatusPill status={node.status} />
      </div>
      <div className="mt-4">
        <p className="text-sm font-black text-slate-950">{node.label}</p>
        <p className="mt-1 min-h-[38px] text-xs leading-relaxed text-slate-600">{node.details}</p>
      </div>
      <div className="mt-3">
        <MetricList metrics={node.metrics} />
      </div>
    </div>
  );
}

function EdgeRow({ edge, nodesById }) {
  const config = statusConfig(edge.status);
  const from = nodesById[edge.from]?.label || edge.from;
  const to = nodesById[edge.to]?.label || edge.to;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="truncate text-sm font-bold text-slate-700">{from}</p>
      <div className="flex min-w-[124px] items-center justify-center gap-2">
        <span className={cx("h-1.5 w-9 rounded-full", config.line)} />
        <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span className="max-w-[96px] truncate text-[10px] font-black uppercase tracking-wide text-slate-400">{edge.label}</span>
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <p className="truncate text-right text-sm font-bold text-slate-700">{to}</p>
        <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", config.dot)} />
      </div>
    </div>
  );
}

function IssueList({ issues }) {
  if (!issues?.length) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No active issues"
        description="All monitored dependencies are reporting healthy status."
      />
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue, index) => (
        <div key={`${issue.component}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-amber-900">{issue.component}</p>
            <Badge tone={issue.severity === "critical" ? "red" : "amber"}>{issue.severity}</Badge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">{issue.message}</p>
        </div>
      ))}
    </div>
  );
}

function ComponentRow({ node }) {
  const Icon = typeIcons[node.type] || Activity;
  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[220px_120px_minmax(0,1fr)] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{node.label}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">{node.type}</p>
        </div>
      </div>
      <StatusPill status={node.status} />
      <div className="min-w-0">
        <p className="text-sm text-slate-600">{node.details}</p>
        <div className="mt-2">
          <MetricList metrics={node.metrics} />
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{agent.agent_id}</p>
            <p className="text-xs text-slate-500">{agent.source} {agent.community}</p>
          </div>
        </div>
        <StatusPill status={agent.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Last seen</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{formatAge(agent.age_seconds)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Heartbeat</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{formatTime(agent.last_seen_at)}</p>
        </div>
      </div>
      {agent.message && <p className="mt-3 text-sm text-slate-600">{agent.message}</p>}
      {agent.last_error && <InlineAlert tone="amber">{agent.last_error}</InlineAlert>}
      <div className="mt-3">
        <MetricList metrics={agent.metrics} />
      </div>
    </div>
  );
}

function ViewToggle({ value, onChange }) {
  const options = [
    { id: "graph", label: "Graph", icon: Workflow },
    { id: "cards", label: "Cards", icon: LayoutGrid },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {createElement(opt.icon, { className: "h-3.5 w-3.5", "aria-hidden": "true" })}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const VIEW_KEY = "dataflow-view";

export default function DataflowsPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "graph";
    return window.localStorage.getItem(VIEW_KEY) || "graph";
  });

  const changeView = useCallback((next) => {
    setView(next);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, next);
  }, []);

  const fetchStatus = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getDataflowStatus();
      setStatus(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to reach the dataflow monitor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus({ quiet: true }), 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const nodes = useMemo(() => {
    const list = status?.nodes || [];
    return [...list].sort((a, b) => nodeOrder.indexOf(a.id) - nodeOrder.indexOf(b.id));
  }, [status]);

  const nodesById = useMemo(
    () => Object.fromEntries((status?.nodes || []).map((node) => [node.id, node])),
    [status],
  );

  const metrics = [
    { label: "Status", value: status?.overall_status || "loading" },
    { label: "Agents", value: `${status?.summary?.active_agents ?? 0}/${status?.summary?.total_agents ?? 0}` },
    { label: "Issues", value: status?.summary?.issue_count ?? 0 },
    { label: "Latest ingest", value: formatTime(status?.summary?.latest_ingest_at) },
  ];

  return (
    <AppShell
      title="Dataflow Monitor"
      description="Live operational graph for source agents, ingestion, AI analysis, storage, database writes, and consumer read paths."
      metrics={metrics}
    >
      {error && (
        <div className="mb-4">
          <InlineAlert>{error}</InlineAlert>
        </div>
      )}

      {loading && !status ? (
        <Panel>
          <EmptyState
            icon={Spinner}
            title="Loading dataflow status"
            description="Collecting backend health, dependency checks, and agent heartbeat state."
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Overall Status" value={status?.overall_status || "unknown"} icon={Gauge} tone={statusConfig(status?.overall_status).tone} />
            <StatTile label="Flagged Records" value={status?.summary?.total_memes ?? 0} icon={Database} tone="sky" />
            <StatTile label="Active Agents" value={`${status?.summary?.active_agents ?? 0}/${status?.summary?.total_agents ?? 0}`} icon={Radio} tone="emerald" />
            <StatTile label="Open Issues" value={status?.summary?.issue_count ?? 0} icon={AlertTriangle} tone={(status?.summary?.issue_count ?? 0) > 0 ? "amber" : "slate"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Panel>
              <PanelHeader
                title="Network"
                eyebrow="Real-time graph"
                action={
                  <div className="flex items-center gap-2">
                    <ViewToggle value={view} onChange={changeView} />
                    <Button type="button" size="sm" icon={RefreshCw} onClick={() => fetchStatus({ quiet: true })} disabled={refreshing}>
                      {refreshing ? "Refreshing" : "Refresh"}
                    </Button>
                  </div>
                }
              >
                Generated {formatTime(status?.generated_at)}
              </PanelHeader>
              {view === "graph" ? (
                <DataflowGraph nodes={nodes} edges={status?.edges || []} />
              ) : (
                <div className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {nodes.map((node) => <NodeCard key={node.id} node={node} />)}
                  </div>
                  <div className="mt-4 grid gap-2 lg:grid-cols-2">
                    {(status?.edges || []).map((edge) => (
                      <EdgeRow key={`${edge.from}-${edge.to}`} edge={edge} nodesById={nodesById} />
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Issues" eyebrow="What needs attention">
                Components marked degraded or down surface here with concrete causes.
              </PanelHeader>
              <div className="p-4">
                <IssueList issues={status?.issues || []} />
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel>
              <PanelHeader title="Component Health" eyebrow="Dependency checks">
                Backend-computed status for every monitored part of the pipeline.
              </PanelHeader>
              <div>
                {nodes.map((node) => <ComponentRow key={node.id} node={node} />)}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Agent Heartbeats" eyebrow="External sources">
                Latest liveness reports from source collectors.
              </PanelHeader>
              <div className="space-y-3 p-4">
                {status?.agents?.length ? (
                  status.agents.map((agent) => <AgentCard key={agent.agent_id} agent={agent} />)
                ) : (
                  <EmptyState
                    icon={Network}
                    title="No agent heartbeats"
                    description="The backend has not received a liveness report from any source agent."
                  />
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
