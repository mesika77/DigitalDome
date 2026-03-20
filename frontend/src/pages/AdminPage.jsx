import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import DropZone from "../components/DropZone";
import DatabaseGrid from "../components/DatabaseGrid";
import { injectBatch, getBatches, deleteMeme, deleteBatch } from "../api/client";

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

  // Bulk-fill values
  const [bulkPlatform, setBulkPlatform] = useState("");
  const [bulkPoster, setBulkPoster] = useState("");
  const [bulkUrl, setBulkUrl] = useState("");

  const fetchBatches = useCallback(async () => {
    try {
      const data = await getBatches();
      if (Array.isArray(data)) setBatches(data);
    } catch { /* silent */ }
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
      }))
    );
  };

  const applyBulkFill = () => {
    setFileMeta((prev) =>
      prev.map((m) => ({
        platform: bulkPlatform || m.platform,
        original_poster: bulkPoster || m.original_poster,
        source_url: bulkUrl || m.source_url,
      }))
    );
  };

  const updateMeta = (idx, field, value) => {
    setFileMeta((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const totalMemes = batches.reduce((sum, b) => sum + (b.memes?.length || 0), 0);
  const allHavePlatform = fileMeta.length > 0 && fileMeta.every((m) => m.platform);
  const canSubmit = files.length > 0 && allHavePlatform && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setLastResult(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
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
      setSuccessCount((p) => p + result.processed);
      fetchBatches();
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to process batch";
      if (err.response?.status === 429 || err.response?.status === 503) {
        toast.error(detail);
      }
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

  const inputClasses = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-red-500/40 focus:outline-none transition-colors";
  const smallInput = "w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white placeholder-white/20 focus:border-red-500/40 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight tracking-tight">DigitalDome Intel</h1>
              <p className="text-[10px] text-white/25">Batch Ingestion Console</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs text-white/25">
              <span><span className="text-white/50 font-semibold">{batches.length}</span> batches</span>
              <span className="text-white/10">|</span>
              <span><span className="text-white/50 font-semibold">{totalMemes}</span> images</span>
              {successCount > 0 && (
                <>
                  <span className="text-white/10">|</span>
                  <span className="text-emerald-400/60"><span className="font-semibold">+{successCount}</span> this session</span>
                </>
              )}
            </div>
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 hover:text-white/70 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Gateway
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: Batch inject form */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/5 bg-white/1.5 p-5 sticky top-20">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Batch Intelligence Upload
              </h2>

              <DropZone onFileSelect={handleFilesSelected} variant="dark" disabled={loading} multiple />

              {/* Bulk fill controls */}
              {files.length > 1 && (
                <div className="mt-3 rounded-xl bg-blue-500/5 border border-blue-500/15 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-blue-400/70 uppercase tracking-wider font-semibold">Bulk Fill All Images</p>
                    <button
                      onClick={applyBulkFill}
                      className="text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-2 py-0.5 rounded transition-colors font-medium"
                    >
                      Apply to all
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={bulkPlatform}
                      onChange={(e) => setBulkPlatform(e.target.value)}
                      className={`${smallInput} appearance-none`}
                    >
                      <option value="" className="bg-[#1a1a1a]">Platform</option>
                      {PLATFORMS.map((p) => <option key={p} value={p} className="bg-[#1a1a1a]">{p}</option>)}
                    </select>
                    <input
                      type="text"
                      value={bulkPoster}
                      onChange={(e) => setBulkPoster(e.target.value)}
                      placeholder="Poster"
                      className={smallInput}
                    />
                    <input
                      type="text"
                      value={bulkUrl}
                      onChange={(e) => setBulkUrl(e.target.value)}
                      placeholder="URL"
                      className={smallInput}
                    />
                  </div>
                </div>
              )}

              {/* Per-image metadata table */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg bg-white/2 border border-white/5 p-2">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-10 h-10 rounded object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex-1 min-w-0 grid grid-cols-3 gap-1.5">
                        <select
                          value={fileMeta[idx]?.platform || ""}
                          onChange={(e) => updateMeta(idx, "platform", e.target.value)}
                          className={`${smallInput} appearance-none`}
                          disabled={loading}
                        >
                          <option value="" className="bg-[#1a1a1a]">Platform *</option>
                          {PLATFORMS.map((p) => <option key={p} value={p} className="bg-[#1a1a1a]">{p}</option>)}
                        </select>
                        <input
                          type="text"
                          value={fileMeta[idx]?.original_poster || ""}
                          onChange={(e) => updateMeta(idx, "original_poster", e.target.value)}
                          placeholder="Poster"
                          className={smallInput}
                          disabled={loading}
                        />
                        <input
                          type="text"
                          value={fileMeta[idx]?.source_url || ""}
                          onChange={(e) => updateMeta(idx, "source_url", e.target.value)}
                          placeholder="URL"
                          className={smallInput}
                          disabled={loading}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Analyst notes */}
              <div className="mt-3">
                <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">Analyst Notes</label>
                <textarea
                  value={analystNotes}
                  onChange={(e) => setAnalystNotes(e.target.value)}
                  placeholder="Additional context or observations..."
                  rows={2}
                  className={`${inputClasses} resize-none`}
                  disabled={loading}
                />
              </div>

              {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

              {lastResult && (
                <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-xs text-emerald-400 font-semibold">
                    Batch processed: {lastResult.processed} images
                    {lastResult.failed > 0 && <span className="text-red-400"> ({lastResult.failed} failed)</span>}
                  </p>
                  <p className="text-[10px] text-emerald-400/50 mt-0.5 font-mono">
                    ID: {lastResult.batch.batch_id.slice(0, 12)}...
                  </p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="mt-4 w-full rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Processing {files.length} image{files.length !== 1 ? "s" : ""}...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Ingest {files.length > 0 ? `${files.length} Image${files.length !== 1 ? "s" : ""}` : "Batch"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Database grid */}
          <div className="lg:col-span-3">
            <DatabaseGrid batches={batches} onDelete={handleDelete} onDeleteBatch={handleDeleteBatch} />
          </div>
        </div>
      </main>
    </div>
  );
}
