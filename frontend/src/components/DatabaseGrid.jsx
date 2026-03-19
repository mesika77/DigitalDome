import { useState } from "react";

function MemeCard({ meme, onDelete }) {
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
          src={meme.thumbnail_url}
          alt={meme.filename}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="inline-flex items-center rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 ring-1 ring-red-500/15 truncate max-w-full">
            {meme.source}
          </span>
          {meme.context ? (
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${
              meme.context.severity === "high" ? "bg-red-500/10 text-red-400 ring-red-500/15"
              : meme.context.severity === "medium" ? "bg-orange-500/10 text-orange-400 ring-orange-500/15"
              : meme.context.severity === "low" ? "bg-yellow-500/10 text-yellow-400 ring-yellow-500/15"
              : "bg-white/5 text-white/40 ring-white/10"
            }`}>
              {meme.context.severity || "unknown"}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-white/30 ring-1 ring-white/10">
              Analyzing…
            </span>
          )}
        </div>
        {meme.community && meme.community !== "Unclassified" && (
          <p className="text-[10px] text-white/40 truncate">{meme.community}</p>
        )}
        <p className="text-[10px] text-white/20 mt-1 font-mono">
          {meme.date_detected} &middot; {meme.phash?.slice(0, 8)}
        </p>
      </div>
    </div>
  );
}

export default function DatabaseGrid({ memes, onDelete }) {
  if (!memes || memes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/1.5 p-12 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <svg className="h-7 w-7 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        </div>
        <p className="text-sm text-white/30 font-medium">No flagged memes yet</p>
        <p className="text-xs text-white/15 mt-1">Upload content to start building the detection database.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30">
          Flagged Content
        </h3>
        <span className="text-xs text-white/20 font-medium">{memes.length} entries</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
        {memes.map((meme) => (
          <MemeCard key={meme.id} meme={meme} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
