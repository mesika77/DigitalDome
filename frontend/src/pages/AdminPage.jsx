import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, ClipboardList, Database, FilePlus2, Plus, UploadCloud } from "lucide-react";
import AppShell from "../components/AppShell";
import DropZone from "../components/DropZone";
import DatabaseGrid from "../components/DatabaseGrid";
import { injectBatch, getBatches, deleteMeme, deleteBatch } from "../api/client";
import {
  Button,
  FieldLabel,
  InlineAlert,
  Panel,
  PanelHeader,
  Spinner,
  StatTile,
} from "../components/ui";
import { inputClass, smallInputClass } from "../components/uiConfig";

const PLATFORMS = ["Reddit", "4chan", "Telegram", "Twitter/X", "Discord", "Gab", "Other"];

export default function AdminPage() {
  const [batches, setBatches] = useState([]);
  const [files, setFiles] = useState([]);
  const [fileMeta, setFileMeta] = useState([]);
  const [analystNotes, setAnalystNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [successCount, setSuccessCount] = useState(0);

  const [bulkPlatform, setBulkPlatform] = useState("");
  const [bulkPoster, setBulkPoster] = useState("");
  const [bulkUrl, setBulkUrl] = useState("");

  const fetchBatches = useCallback(async () => {
    try {
      const data = await getBatches();
      if (Array.isArray(data)) setBatches(data);
    } catch {
      /* keep the ingestion form usable if refresh fails */
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    const interval = setInterval(fetchBatches, 5000);
    return () => clearInterval(interval);
  }, [fetchBatches]);

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
    setFileMeta(
      (selectedFiles || []).map(() => ({
        platform: bulkPlatform || "",
        original_poster: bulkPoster || "",
        source_url: bulkUrl || "",
      })),
    );
  };

  const applyBulkFill = () => {
    setFileMeta((prev) =>
      prev.map((meta) => ({
        platform: bulkPlatform || meta.platform,
        original_poster: bulkPoster || meta.original_poster,
        source_url: bulkUrl || meta.source_url,
      })),
    );
  };

  const updateMeta = (idx, field, value) => {
    setFileMeta((prev) => prev.map((meta, index) => (index === idx ? { ...meta, [field]: value } : meta)));
  };

  const totalMemes = batches.reduce((sum, batch) => sum + (batch.memes?.length || 0), 0);
  const allHavePlatform = fileMeta.length > 0 && fileMeta.every((meta) => meta.platform);
  const canSubmit = files.length > 0 && allHavePlatform && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setLastResult(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("image_metadata", JSON.stringify(fileMeta));
      if (analystNotes.trim()) formData.append("analyst_notes", analystNotes.trim());

      const result = await injectBatch(formData);
      setLastResult(result);
      setFiles([]);
      setFileMeta([]);
      setAnalystNotes("");
      setBulkPlatform("");
      setBulkPoster("");
      setBulkUrl("");
      setSuccessCount((previous) => previous + result.processed);
      fetchBatches();
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to process batch";
      if (err.response?.status === 429 || err.response?.status === 503) toast.error(detail);
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteMeme(id);
    fetchBatches();
  };

  const handleDeleteBatch = async (batchId) => {
    await deleteBatch(batchId);
    fetchBatches();
  };

  const missingPlatformCount = fileMeta.filter((meta) => !meta.platform).length;

  return (
    <AppShell
      title="Ingestion"
      description="Upload flagged content, attach source metadata, and keep the evidence database current for downstream scans."
      metrics={[
        { label: "Batches", value: batches.length },
        { label: "Images", value: totalMemes },
        { label: "This session", value: successCount ? `+${successCount}` : "0" },
      ]}
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,0.9fr)_1.4fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Queued" value={files.length} icon={UploadCloud} tone="sky" />
            <StatTile label="Ready" value={allHavePlatform ? files.length : Math.max(files.length - missingPlatformCount, 0)} icon={CheckCircle2} tone="emerald" />
            <StatTile label="Missing" value={missingPlatformCount} icon={ClipboardList} tone={missingPlatformCount ? "amber" : "slate"} />
          </div>

          <Panel>
            <PanelHeader eyebrow="Batch ingestion" title="Upload and classify source images">
              Platform is required for every image. Poster and URL are optional but useful for investigation.
            </PanelHeader>
            <div className="space-y-4 p-4">
              <DropZone onFileSelect={handleFilesSelected} disabled={loading} multiple />

              {files.length > 1 && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Bulk metadata</p>
                      <p className="text-xs text-sky-700/70">Apply shared source details across selected images.</p>
                    </div>
                    <Button type="button" variant="primary" size="sm" icon={Plus} onClick={applyBulkFill}>
                      Apply
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select value={bulkPlatform} onChange={(event) => setBulkPlatform(event.target.value)} className={smallInputClass}>
                      <option value="">Platform</option>
                      {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                    </select>
                    <input type="text" value={bulkPoster} onChange={(event) => setBulkPoster(event.target.value)} placeholder="Poster" className={smallInputClass} />
                    <input type="text" value={bulkUrl} onChange={(event) => setBulkUrl(event.target.value)} placeholder="Source URL" className={smallInputClass} />
                  </div>
                </div>
              )}

              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Image metadata</p>
                    <p className="text-xs font-semibold text-slate-500">{files.length} selected</p>
                  </div>
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {files.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="grid grid-cols-[48px_1fr] gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                        <img src={URL.createObjectURL(file)} alt={file.name} className="h-12 w-12 rounded-md border border-slate-200 object-cover" />
                        <div className="min-w-0">
                          <p className="mb-2 truncate text-xs font-bold text-slate-700">{file.name}</p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <select value={fileMeta[idx]?.platform || ""} onChange={(event) => updateMeta(idx, "platform", event.target.value)} className={smallInputClass} disabled={loading}>
                              <option value="">Platform *</option>
                              {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                            </select>
                            <input type="text" value={fileMeta[idx]?.original_poster || ""} onChange={(event) => updateMeta(idx, "original_poster", event.target.value)} placeholder="Poster" className={smallInputClass} disabled={loading} />
                            <input type="text" value={fileMeta[idx]?.source_url || ""} onChange={(event) => updateMeta(idx, "source_url", event.target.value)} placeholder="Source URL" className={smallInputClass} disabled={loading} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <FieldLabel>Analyst notes</FieldLabel>
                <textarea
                  value={analystNotes}
                  onChange={(event) => setAnalystNotes(event.target.value)}
                  placeholder="Add observations, source context, or collection notes..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                  disabled={loading}
                />
              </div>

              {error && <InlineAlert>{error}</InlineAlert>}

              {lastResult && (
                <InlineAlert tone="emerald" icon={CheckCircle2}>
                  <span className="font-bold">Batch processed:</span> {lastResult.processed} images
                  {lastResult.failed > 0 && <span className="font-bold text-red-700"> ({lastResult.failed} failed)</span>}
                  <span className="ml-2 font-mono text-xs">ID {lastResult.batch.batch_id.slice(0, 12)}</span>
                </InlineAlert>
              )}

              {!allHavePlatform && files.length > 0 && (
                <InlineAlert tone="amber">
                  Add a platform for every selected image before ingesting this batch.
                </InlineAlert>
              )}

              <Button type="button" variant="primary" size="lg" icon={loading ? undefined : FilePlus2} disabled={!canSubmit} onClick={handleSubmit} className="w-full">
                {loading ? (
                  <>
                    <Spinner />
                    Processing {files.length} image{files.length !== 1 ? "s" : ""}
                  </>
                ) : (
                  <>Ingest {files.length > 0 ? `${files.length} image${files.length !== 1 ? "s" : ""}` : "batch"}</>
                )}
              </Button>
            </div>
          </Panel>
        </div>

        <DatabaseGrid batches={batches} onDelete={handleDelete} onDeleteBatch={handleDeleteBatch} />
      </div>
    </AppShell>
  );
}
