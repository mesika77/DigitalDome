function SimilarityBar({ score, color }) {
  return (
    <div className="w-full mt-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white/40">Similarity</span>
        <span className={`font-semibold ${color}`}>{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            score >= 80
              ? "bg-red-500"
              : score >= 50
                ? "bg-yellow-500"
                : "bg-green-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function BlockedCard({ result }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 animate-fade-in-scale">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🚫</span>
        <div>
          <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide">
            Upload Blocked
          </h3>
          <p className="text-xs text-red-300/60">
            This content was detected in our radical community database.
          </p>
        </div>
      </div>

      {result.match && (
        <div className="flex gap-3 my-3 p-3 rounded-lg bg-black/20">
          {result.uploaded_image_url && (
            <div className="flex-1">
              <p className="text-[10px] text-white/30 mb-1 uppercase">Uploaded</p>
              <img
                src={result.uploaded_image_url}
                alt="Uploaded"
                className="w-full aspect-square object-cover rounded-lg border border-white/10"
              />
            </div>
          )}
          <div className="flex-1">
            <p className="text-[10px] text-white/30 mb-1 uppercase">Database Match</p>
            <img
              src={result.match.thumbnail_url}
              alt="Match"
              className="w-full aspect-square object-cover rounded-lg border border-red-500/20"
            />
          </div>
        </div>
      )}

      {result.match && (
        <div className="text-xs text-white/50 space-y-0.5 mb-2">
          <p>
            <span className="text-white/30">Origin:</span>{" "}
            <span className="text-red-300">{result.match.source}</span> &mdash;{" "}
            {result.match.community} &mdash; detected on {result.match.date_detected}
          </p>
        </div>
      )}

      <SimilarityBar score={result.similarity_score} color="text-red-400" />

      {result.ai_analysis?.analysis && (
        <div className="mt-3 rounded-lg bg-black/20 p-3">
          <p className="text-[10px] text-white/30 uppercase mb-1">AI Analysis</p>
          <p className="text-xs text-white/60">{result.ai_analysis.analysis}</p>
        </div>
      )}

      <p className="mt-3 text-xs text-red-300/60 font-medium">
        This meme will not be published.
      </p>
    </div>
  );
}

function PendingCard({ result }) {
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 animate-fade-in-scale">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">⏸</span>
        <div>
          <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-wide">
            Upload Held for Manual Review
          </h3>
          <p className="text-xs text-yellow-300/60">
            This content shows similarity to flagged material.
          </p>
        </div>
      </div>

      <SimilarityBar score={result.similarity_score} color="text-yellow-400" />

      {result.ai_analysis?.analysis && (
        <div className="mt-3 rounded-lg bg-black/20 p-3">
          <p className="text-[10px] text-white/30 uppercase mb-1">AI Analysis</p>
          <p className="text-xs text-white/60">{result.ai_analysis.analysis}</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <svg className="animate-spin h-3.5 w-3.5 text-yellow-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs text-yellow-300/60">
          Sending to manual review queue...
        </p>
      </div>

      <p className="mt-2 text-xs text-yellow-300/50">
        A moderator will review this before publishing.
      </p>
    </div>
  );
}

function ApprovedCard({ result }) {
  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 animate-fade-in-scale">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">✅</span>
        <div>
          <h3 className="text-sm font-bold text-green-400 uppercase tracking-wide">
            Upload Approved
          </h3>
          <p className="text-xs text-green-300/60">
            No matches found in the radical content database.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-1 mt-2">
        <span className="text-white/40">AI Confidence</span>
        <span className="font-semibold text-green-400">{result.ai_confidence}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-700 ease-out"
          style={{ width: `${Math.max(100 - (result.ai_confidence || 0), 5)}%` }}
        />
      </div>

      {result.ai_analysis?.analysis && result.ai_analysis.analysis !== "AI analysis unavailable — falling back to hash-only matching." && (
        <div className="mt-3 rounded-lg bg-black/20 p-3">
          <p className="text-[10px] text-white/30 uppercase mb-1">AI Analysis</p>
          <p className="text-xs text-white/60">{result.ai_analysis.analysis}</p>
        </div>
      )}

      <p className="mt-3 text-xs text-green-300/60 font-medium">
        Your content has been cleared for publishing.
      </p>
    </div>
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
