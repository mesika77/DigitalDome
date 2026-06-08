import { useState } from "react";
import { ChevronDown, Database, Layers, Trash2, X } from "lucide-react";
import { imageUrl, getImagePath } from "../api/client";
import { Button, EmptyState, Panel, PanelHeader, StatusBadge } from "./ui";
import { cx, platformStyles } from "./uiConfig";

function SeverityBadge({ severity }) {
  return <StatusBadge value={severity || "analyzing"} />;
}

function PlatformBadge({ platform }) {
  if (!platform || platform === "Unknown") return null;
  return <StatusBadge value={platform} map={platformStyles} />;
}

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
    <div className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={imageUrl(getImagePath(meme))}
          alt={meme.filename || "Flagged content"}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {onDelete && (
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
            {confirming && (
              <Button type="button" variant="secondary" size="icon" onClick={() => setConfirming(false)} aria-label="Cancel delete">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant={confirming ? "danger" : "secondary"}
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={confirming ? "Confirm delete image" : "Delete image"}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2 p-2.5">
        <div className="flex flex-wrap gap-1">
          <SeverityBadge severity={meme.context?.severity} />
          <PlatformBadge platform={meme.platform} />
        </div>
        <div>
          <p className="truncate text-xs font-bold text-slate-700">{meme.original_poster && meme.original_poster !== "Unknown" ? meme.original_poster : "Unknown poster"}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{meme.phash?.slice(0, 14) || "hash pending"}</p>
        </div>
      </div>
    </div>
  );
}

function BatchCard({ batch, onDelete, onDeleteBatch }) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const createdAt = new Date(batch.created_at);
  const timeStr = `${createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${createdAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;

  const memes = batch.memes || [];
  const platforms = [...new Set(memes.map((meme) => meme.platform).filter(Boolean))];
  const posters = [...new Set(memes.map((meme) => meme.original_poster).filter((poster) => poster && poster !== "Unknown"))];

  const handleDeleteBatch = async (event) => {
    event.stopPropagation();
    if (!confirmingBatch) {
      setConfirmingBatch(true);
      return;
    }
    setDeletingBatch(true);
    try {
      await onDeleteBatch?.(batch.batch_id);
    } finally {
      setDeletingBatch(false);
      setConfirmingBatch(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center border-b border-slate-100 bg-slate-50/70">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-100"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-sky-700 shadow-sm">
            <Layers className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              {platforms.length > 0 ? platforms.map((platform) => <PlatformBadge key={platform} platform={platform} />) : <span className="text-xs font-semibold text-slate-500">Unclassified source</span>}
              {posters.length > 0 && (
                <span className="truncate text-xs font-semibold text-slate-500">
                  {posters.length <= 2 ? posters.join(", ") : `${posters.length} accounts`}
                </span>
              )}
            </span>
            <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span>{timeStr}</span>
              <span aria-hidden="true">/</span>
              <span className="font-bold text-slate-700">{memes.length} image{memes.length !== 1 ? "s" : ""}</span>
            </span>
          </span>
          <ChevronDown className={cx("h-4 w-4 shrink-0 text-slate-400 transition", collapsed ? "-rotate-90" : "rotate-0")} aria-hidden="true" />
        </button>

        {onDeleteBatch && (
          <div className="flex items-center gap-1 pr-3">
            {confirmingBatch && (
              <Button type="button" variant="secondary" size="icon" onClick={(event) => {
                event.stopPropagation();
                setConfirmingBatch(false);
              }} aria-label="Cancel batch delete">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant={confirmingBatch ? "danger" : "ghost"}
              size="icon"
              onClick={handleDeleteBatch}
              disabled={deletingBatch}
              aria-label={confirmingBatch ? "Confirm delete batch" : "Delete batch"}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="p-4">
          {batch.analyst_notes && (
            <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              {batch.analyst_notes}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {memes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function DatabaseGrid({ batches, memes, onDelete, onDeleteBatch }) {
  const hasBatches = batches && batches.length > 0;
  const hasLegacyMemes = memes && memes.length > 0;

  if (!hasBatches && !hasLegacyMemes) {
    return (
      <Panel>
        <EmptyState
          icon={Database}
          title="No flagged content uploaded"
          description="Ingest a batch to begin building the evidence database."
        />
      </Panel>
    );
  }

  const totalImages = hasBatches
    ? batches.reduce((sum, batch) => sum + (batch.memes?.length || 0), 0)
    : memes?.length || 0;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        eyebrow="Database"
        title="Recent ingestion batches"
        action={<span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{hasBatches ? `${batches.length} batches / ` : ""}{totalImages} images</span>}
      />

      <div className="max-h-[calc(100vh-230px)] space-y-3 overflow-y-auto p-4">
        {hasBatches && batches.map((batch) => (
          <BatchCard key={batch.id} batch={batch} onDelete={onDelete} onDeleteBatch={onDeleteBatch} />
        ))}
        {hasLegacyMemes && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {memes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
