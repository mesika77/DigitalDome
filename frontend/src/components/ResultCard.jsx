import { imageUrl } from "../api/client";

function SeverityBadge({ severity }) {
  const config = {
    high: "bg-red-500/15 text-red-400 ring-red-500/20",
    medium: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
    low: "bg-yellow-500/15 text-yellow-400 ring-yellow-500/20",
  };
  const classes = config[severity] || "bg-white/10 text-white/40 ring-white/10";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${classes}`}>
      {severity || "unknown"}
    </span>
  );
}

function ContextCard({ context, borderColor = "border-red-500/20" }) {
  if (!context) return null;
  return (
    <div className={`mt-4 rounded-xl bg-black/30 border ${borderColor} p-4`}>
      <p className="text-[11px] text-white/50 uppercase tracking-wider font-bold mb-3">
        Why This Was Flagged
      </p>
      <div className="h-px bg-white/10 mb-3" />
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="text-white/30 shrink-0 w-28">What it depicts</span>
          <span className="text-white/70">{context.what_it_depicts}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-white/30 shrink-0 w-28">Why harmful</span>
          <span className="text-white/70">{context.why_harmful}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-white/30 shrink-0 w-28">Target group</span>
          <span className="text-white/70">{context.target_group}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-white/30 shrink-0 w-28">Severity</span>
          <SeverityBadge severity={context.severity} />
        </div>
        <div className="flex gap-2">
          <span className="text-white/30 shrink-0 w-28">Coded elements</span>
          <span className="text-white/70">
            {Array.isArray(context.coded_elements) && context.coded_elements.length > 0
              ? context.coded_elements.join(", ")
              : "None identified"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-white/30 shrink-0 w-28">Origin</span>
          <span className="text-white/70">{context.origin_community}</span>
        </div>
      </div>
    </div>
  );
}

function SimilarityBar({ score, label = "Similarity", color }) {
  const barColor = score >= 80 ? "bg-red-500" : score >= 50 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-white/40 font-medium">{label}</span>
        <span className={`font-bold text-sm ${color}`}>{score}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full animate-bar-fill ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function BlockedCard({ result }) {
  const hasDbMatch = !!result.match;
  const contextData = result.match?.context || result.ai_context;

  return (
    <div className="rounded-2xl border border-red-500/20 bg-linear-to-b from-red-500/10 to-red-950/20 p-6 animate-fade-in-up animate-pulse-glow">
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center ring-2 ring-red-500/20">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-red-400 tracking-tight">
            Upload Blocked
          </h3>
          <p className="text-sm text-white/40 mt-0.5">
            {hasDbMatch
              ? "This content was detected in our radical community database."
              : "AI analysis detected harmful content in this upload."}
          </p>
        </div>
      </div>

      {hasDbMatch && (
        <div className="grid grid-cols-2 gap-3 my-4 p-3 rounded-xl bg-black/30 border border-white/5">
          {result.uploaded_image_url && (
            <div>
              <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider font-semibold">Your Upload</p>
              <img
                src={imageUrl(result.uploaded_image_url)}
                alt="Uploaded"
                onError={(e) => { e.target.style.display = 'none' }}
                className="w-full aspect-square object-cover rounded-xl border border-white/10"
              />
            </div>
          )}
          <div>
            <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider font-semibold">Database Match</p>
            <img
              src={imageUrl(result.match.thumbnail_url)}
              alt="Match"
              onError={(e) => { e.target.style.display = 'none' }}
              className="w-full aspect-square object-cover rounded-xl border-2 border-red-500/30"
            />
          </div>
        </div>
      )}

      {hasDbMatch && (
        <div className="rounded-xl bg-black/20 border border-white/5 p-3 mb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-white/30 uppercase mb-0.5">Source</p>
              <p className="text-xs text-red-300 font-semibold">{result.match.source}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase mb-0.5">Community</p>
              <p className="text-xs text-white/60 font-medium">{result.match.community}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase mb-0.5">Detected</p>
              <p className="text-xs text-white/60 font-medium">{result.match.date_detected}</p>
            </div>
          </div>
        </div>
      )}

      {hasDbMatch && (
        <SimilarityBar score={result.similarity_score} color="text-red-400" />
      )}

      {contextData && (
        <ContextCard context={contextData} borderColor="border-red-500/20" />
      )}

      {result.ai_analysis?.analysis && result.ai_analysis.analysis !== "AI analysis unavailable \u2014 falling back to hash-only matching." && (
        <div className="mt-4 rounded-xl bg-black/20 border border-white/5 p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5">AI Analysis</p>
          <p className="text-sm text-white/60 leading-relaxed">{result.ai_analysis.analysis}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/20">
        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm text-red-300 font-medium">This content will not be published.</p>
      </div>
    </div>
  );
}

function PendingCard({ result }) {
  const hasDbMatch = !!result.match;
  const contextData = result.match?.context || result.ai_context;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-linear-to-b from-amber-500/10 to-amber-950/20 p-6 animate-fade-in-up">
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 w-11 h-11 rounded-full bg-amber-500/15 flex items-center justify-center ring-2 ring-amber-500/20">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-amber-400 tracking-tight">
            Held for Manual Review
          </h3>
          <p className="text-sm text-white/40 mt-0.5">
            {hasDbMatch
              ? "This content shows similarity to flagged material."
              : "AI analysis flagged this content for review."}
          </p>
        </div>
      </div>

      {hasDbMatch && (
        <SimilarityBar score={result.similarity_score} label="Match Score" color="text-amber-400" />
      )}

      {contextData && (
        <ContextCard context={contextData} borderColor="border-amber-500/20" />
      )}

      {result.ai_analysis?.analysis && result.ai_analysis.analysis !== "AI analysis unavailable \u2014 falling back to hash-only matching." && (
        <div className="mt-4 rounded-xl bg-black/20 border border-white/5 p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5">AI Analysis</p>
          <p className="text-sm text-white/60 leading-relaxed">{result.ai_analysis.analysis}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 py-3 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="shrink-0 relative">
          <div className="h-5 w-5 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm text-amber-300 font-medium">Sending to review queue...</p>
          <p className="text-xs text-amber-300/40 mt-0.5">A moderator will review this before publishing.</p>
        </div>
      </div>
    </div>
  );
}

function ApprovedCard({ result }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-linear-to-b from-emerald-500/10 to-emerald-950/20 p-6 animate-fade-in-up">
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 w-11 h-11 rounded-full bg-emerald-500/15 flex items-center justify-center ring-2 ring-emerald-500/20">
          <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" className="animate-checkmark" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-emerald-400 tracking-tight">
            Upload Approved
          </h3>
          <p className="text-sm text-white/40 mt-0.5">
            No matches found in the radical content database.
          </p>
        </div>
      </div>

      <SimilarityBar score={100 - (result.ai_confidence || 0)} label="Risk Level" color="text-emerald-400" />

      {result.ai_analysis?.analysis && result.ai_analysis.analysis !== "AI analysis unavailable \u2014 falling back to hash-only matching." && (
        <div className="mt-4 rounded-xl bg-black/20 border border-white/5 p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5">AI Analysis</p>
          <p className="text-sm text-white/60 leading-relaxed">{result.ai_analysis.analysis}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <p className="text-sm text-emerald-300 font-medium">Content cleared for publishing.</p>
      </div>
    </div>
  );
}

export default function ResultCard({ result }) {
  if (!result) return null;
  switch (result.status) {
    case "blocked": return <BlockedCard result={result} />;
    case "pending": return <PendingCard result={result} />;
    case "approved": return <ApprovedCard result={result} />;
    default: return null;
  }
}
