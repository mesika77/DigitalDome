import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import DropZone from "../components/DropZone";
import DatabaseGrid from "../components/DatabaseGrid";
import { injectMeme, getDatabase, deleteMeme } from "../api/client";

export default function AdminPage() {
  const [memes, setMemes] = useState([]);
  const [file, setFile] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [source, setSource] = useState("");
  const [community, setCommunity] = useState("");
  const [dateDetected, setDateDetected] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [contextNotes, setContextNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);

  const fetchMemes = useCallback(async () => {
    try {
      const data = await getDatabase();
      setMemes(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchMemes();
    const interval = setInterval(fetchMemes, 5000);
    return () => clearInterval(interval);
  }, [fetchMemes]);

  const canSubmit = file && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (source.trim()) formData.append("source", source.trim());
      if (community.trim()) formData.append("community", community.trim());
      formData.append("date_detected", dateDetected);
      if (contextNotes.trim()) formData.append("context_notes", contextNotes.trim());

      await injectMeme(formData);
      setFile(null);
      setSource("");
      setCommunity("");
      setContextNotes("");
      setDateDetected(new Date().toISOString().split("T")[0]);
      setSuccessCount((p) => p + 1);
      fetchMemes();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to inject meme");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteMeme(id);
    setMemes((prev) => prev.filter((m) => m.id !== id));
  };

  const inputClasses = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-red-500/40 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Admin header */}
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-red-500 to-red-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight tracking-tight">DigitalDome Admin</h1>
              <p className="text-[10px] text-white/25">Source Database Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs text-white/25">
              <span><span className="text-white/50 font-semibold">{memes.length}</span> entries</span>
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
              Gateway View
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left: Inject form */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/5 bg-white/1.5 p-5 sticky top-20">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Inject Flagged Content
              </h2>

              <DropZone onFileSelect={setFile} variant="dark" disabled={loading} />

              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="mt-3 flex items-center gap-1.5 text-xs text-white/25 hover:text-white/40 transition-colors"
              >
                <svg
                  className={`h-3 w-3 transition-transform ${showDetails ? "rotate-90" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {showDetails ? "Hide details" : "Add optional metadata"}
              </button>

              {showDetails && (
                <div className="mt-3 space-y-3 animate-slide-down">
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">Source</label>
                    <input type="text" value={source} onChange={(e) => setSource(e.target.value)}
                      placeholder="e.g. 4chan /pol/" className={inputClasses} disabled={loading} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">Community</label>
                    <input type="text" value={community} onChange={(e) => setCommunity(e.target.value)}
                      placeholder="e.g. Siege Culture" className={inputClasses} disabled={loading} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">Date Detected</label>
                    <input type="date" value={dateDetected} onChange={(e) => setDateDetected(e.target.value)}
                      className={`${inputClasses} scheme-dark`} disabled={loading} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">Context Notes</label>
                    <textarea value={contextNotes} onChange={(e) => setContextNotes(e.target.value)}
                      placeholder="Auto-generated by AI if left blank" rows={2}
                      className={`${inputClasses} resize-none`} disabled={loading} />
                  </div>
                </div>
              )}

              {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="mt-4 w-full rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add to Database
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Database grid */}
          <div className="lg:col-span-3">
            <DatabaseGrid memes={memes} onDelete={handleDelete} />
          </div>
        </div>
      </main>
    </div>
  );
}
