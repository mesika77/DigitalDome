export default function DatabaseGrid({ memes }) {
  if (!memes || memes.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-white/5 bg-white/2 p-8 text-center">
        <svg
          className="mx-auto h-10 w-10 text-white/20"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
          />
        </svg>
        <p className="mt-3 text-sm text-white/30">No memes in database yet.</p>
        <p className="text-xs text-white/20 mt-1">Start injecting from the source panel.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
        Database Entries ({memes.length})
      </h3>
      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
        {memes.map((meme) => (
          <div
            key={meme.id}
            className="group rounded-lg border border-white/5 bg-white/2 hover:bg-white/4 transition-colors overflow-hidden"
          >
            <div className="aspect-square overflow-hidden bg-black/20">
              <img
                src={meme.thumbnail_url}
                alt={meme.filename}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 ring-1 ring-red-500/20">
                  {meme.source}
                </span>
              </div>
              <p className="text-[10px] text-white/30 mt-1">
                {meme.date_detected} &middot; <span className="font-mono">{meme.phash?.slice(0, 8)}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
