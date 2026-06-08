import { createElement } from "react";
import { AlertOctagon, CheckCircle2, Clock3, FileText, ShieldAlert } from "lucide-react";
import { imageUrl } from "../api/client";
import { Badge, InlineAlert, Panel, PanelHeader, StatusBadge } from "./ui";
import { cx } from "./uiConfig";

function ContextCard({ context }) {
  if (!context) return null;
  const rows = [
    ["What it depicts", context.what_it_depicts],
    ["Why harmful", context.why_harmful],
    ["Target group", context.target_group],
    ["Origin community", context.origin_community],
  ].filter(([, value]) => value);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Evidence context</p>
        <StatusBadge value={context.severity} />
      </div>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="text-sm leading-relaxed text-slate-700">{value}</p>
          </div>
        ))}
        <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
          <p className="text-xs font-bold text-slate-500">Coded elements</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.isArray(context.coded_elements) && context.coded_elements.length > 0
              ? context.coded_elements.map((element, index) => <Badge key={`${element}-${index}`}>{element}</Badge>)
              : <span className="text-sm text-slate-500">None identified</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimilarityBar({ score = 0, label = "Similarity" }) {
  const barColor = score >= 80 ? "bg-red-600" : score >= 50 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500">{label}</span>
        <span className="text-sm font-black text-slate-950">{score}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className={cx("h-full rounded-full animate-bar-fill", barColor)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function AIAnalysis({ result }) {
  const analysis = result.ai_analysis?.analysis;
  if (!analysis || analysis === "AI analysis unavailable - falling back to hash-only matching." || analysis === "AI analysis unavailable — falling back to hash-only matching.") {
    return null;
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        <FileText className="h-4 w-4" aria-hidden="true" />
        AI analysis
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{analysis}</p>
    </div>
  );
}

function MatchComparison({ result }) {
  if (!result.match) return null;
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
      {result.uploaded_image_url && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Uploaded image</p>
          <img
            src={imageUrl(result.uploaded_image_url)}
            alt="Uploaded content"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="aspect-square w-full rounded-lg border border-slate-200 bg-white object-cover"
          />
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Database match</p>
        <img
          src={imageUrl(result.match.thumbnail_url)}
          alt="Database match"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className="aspect-square w-full rounded-lg border border-red-200 bg-white object-cover"
        />
      </div>
    </div>
  );
}

function ResultShell({ result, tone, icon: Icon, title, subtitle, footer }) {
  const contextData = result.match?.context || result.ai_context;
  const tones = {
    blocked: {
      header: "border-red-200 bg-red-50 text-red-700",
      panel: "border-red-200",
      action: "red",
    },
    pending: {
      header: "border-amber-200 bg-amber-50 text-amber-700",
      panel: "border-amber-200",
      action: "amber",
    },
    approved: {
      header: "border-emerald-200 bg-emerald-50 text-emerald-700",
      panel: "border-emerald-200",
      action: "emerald",
    },
  };
  const selected = tones[tone];

  return (
    <Panel className={cx("overflow-hidden", selected.panel)}>
      <PanelHeader
        eyebrow="Scan decision"
        title={title}
        className={selected.header}
        action={createElement(Icon, { className: "h-6 w-6", "aria-hidden": "true" })}
      >
        {subtitle}
      </PanelHeader>
      <div className="space-y-4 p-4">
        <MatchComparison result={result} />

        {result.match && (
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-slate-500">Source</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{result.match.source || "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Community</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{result.match.community || "Unclassified"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Detected</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{result.match.date_detected || "Unknown"}</p>
            </div>
          </div>
        )}

        {result.match && <SimilarityBar score={result.similarity_score} label="Database similarity" />}
        {tone === "approved" && <SimilarityBar score={Math.max(0, 100 - (result.ai_confidence || 0))} label="Risk level" />}

        <ContextCard context={contextData} />
        <AIAnalysis result={result} />
        <InlineAlert tone={selected.action} icon={tone === "approved" ? CheckCircle2 : tone === "pending" ? Clock3 : ShieldAlert}>
          {footer}
        </InlineAlert>
      </div>
    </Panel>
  );
}

function BlockedCard({ result }) {
  return (
    <ResultShell
      result={result}
      tone="blocked"
      icon={AlertOctagon}
      title="Upload blocked"
      subtitle={result.match ? "The upload matches flagged evidence and will not be cleared." : "AI analysis detected harmful content in this upload."}
      footer="This content is not cleared for publishing."
    />
  );
}

function PendingCard({ result }) {
  return (
    <ResultShell
      result={result}
      tone="pending"
      icon={Clock3}
      title="Held for review"
      subtitle={result.match ? "The upload resembles flagged material and needs analyst review." : "AI analysis flagged this upload for review."}
      footer="A reviewer should inspect this item before any publishing decision."
    />
  );
}

function ApprovedCard({ result }) {
  return (
    <ResultShell
      result={result}
      tone="approved"
      icon={CheckCircle2}
      title="Upload approved"
      subtitle="No blocking database match or AI risk signal was returned."
      footer="Content is cleared by the current scan policy."
    />
  );
}

export default function ResultCard({ result }) {
  if (!result) return null;
  switch (result.status) {
    case "blocked":
      return <BlockedCard result={result} />;
    case "pending":
      return <PendingCard result={result} />;
    case "approved":
      return <ApprovedCard result={result} />;
    default:
      return null;
  }
}
