import { useState } from "react";
import { imageUrl } from "../api/client";

function SeverityBadge({ severity }) {
  if (!severity) {
    return (
      <span className="inline-flex items-center rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-white/30 ring-1 ring-white/10">
        Analyzing…
      </span>
    );
  }
  const config = {
    high: "bg-red-500/10 text-red-400 ring-red-500/15",
    medium: "bg-orange-500/10 text-orange-400 ring-orange-500/15",
    low: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/15",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${config[severity] || "bg-white/5 text-white/40 ring-white/10"}`}>
      {severity}
    </span>
  );
}

function PlatformBadge({ platform }) {
  if (!platform || platform === "Unknown") return null;
  const colors = {
    Reddit: "bg-orange-500/10 text-orange-400 ring-orange-500/15",
    "4chan": "bg-green-500/10 text-green-400 ring-green-500/15",
    Telegram: "bg-blue-500/10 text-blue-400 ring-blue-500/15",
    "Twitter/X": "bg-sky-500/10 text-sky-400 ring-sky-500/15",
    Discord: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/15",
    Gab: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/15",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${colors[platform] || "bg-white/5 text-white/40 ring-white/10"}`}>
      {platform}
    </span>
  );
}

function MemeCard({ meme, onDelete, compact = false }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete?.(meme.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="group relative rounded-xl border border-white/5 bg-white/1.5 hover:bg-white/3 transition-all duration-200 overflow-hidden hover:border-white/10">
      {onDelete && (
        <div className={`absolute top-1.5 right-1.5 z-10 flex items-center gap-1 transition-opacity ${confirming ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {confirming && (
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md bg-black/60 backdrop-blur-sm p-1 text-white/50 hover:text-white/80 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`rounded-md backdrop-blur-sm p-1 transition-colors ${
              confirming
                ? "bg-red-600/80 text-white hover:bg-red-500"
                : "bg-black/60 text-white/50 hover:text-red-400"
            } disabled:opacity-50`}
          >
            {deleting ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      )}
      <div className="aspect-square overflow-hidden bg-black/30">
        <img
          src={imageUrl(meme.thumbnail_url)}
          alt={meme.filename}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-2">
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          <SeverityBadge severity={meme.context?.severity} />
          <PlatformBadge platform={meme.platform} />
        </div>
        {meme.original_poster && meme.original_poster !== "Unknown" && (
          <p className="text-[10px] text-white/40 truncate">{meme.original_poster}</p>
        )}
        <p className="text-[10px] text-white/20 font-mono truncate mt-0.5">
          {meme.phash?.slice(0, 12)}
        </p>
      </div>
    </div>
  );
}

function BatchCard({ batch, onDelete }) {
  const [collapsed, setCollapsed] = useState(false);
  const ts = new Date(batch.created_at);
  const timeStr = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const platforms = [...new Set(batch.memes.map((m) => m.platform).filter(Boolean))];
  const posters = [...new Set(batch.memes.map((m) => m.original_poster).filter((p) => p && p !== "Unknown"))];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/1.5 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/3 transition-colors text-left"
      >
        <div className="shrink-0 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/15">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {platforms.map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
            {posters.length > 0 && (
              <span className="text-xs text-white/40 truncate">
                {posters.length <= 2 ? posters.join(", ") : `${posters.length} accounts`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-white/20">{timeStr}</span>
            <span className="text-[10px] text-white/20">&middot;</span>
            <span className="text-[10px] text-white/30 font-medium">{batch.image_count} image{batch.image_count !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-white/20 shrink-0 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3">
          {batch.analyst_notes && (
            <p className="text-[11px] text-white/30 italic mb-2 px-1">{batch.analyst_notes}</p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {batch.memes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} onDelete={onDelete} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DatabaseGrid({ batches, memes, onDelete }) {
  const hasBatches = batches && batches.length > 0;
  const hasLegacyMemes = memes && memes.length > 0;

  if (!hasBatches && !hasLegacyMemes) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/1.5 p-12 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <svg className="h-7 w-7 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        </div>
        <p className="text-sm text-white/30 font-medium">No intelligence uploaded yet</p>
        <p className="text-xs text-white/15 mt-1">Upload a batch to start building the threat database.</p>
      </div>
    );
  }

  const totalImages = hasBatches
    ? batches.reduce((sum, b) => sum + (b.memes?.length || 0), 0)
    : memes?.length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30">
          Intelligence Database
        </h3>
        <span className="text-xs text-white/20 font-medium">
          {hasBatches ? `${batches.length} batches` : ""}{hasBatches && totalImages > 0 ? " · " : ""}{totalImages} images
        </span>
      </div>

      <div className="space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
        {hasBatches && batches.map((batch) => (
          <BatchCard key={batch.id} batch={batch} onDelete={onDelete} />
        ))}
        {hasLegacyMemes && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {memes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
