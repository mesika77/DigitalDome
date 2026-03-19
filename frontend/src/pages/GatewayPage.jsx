import { useState, useEffect, useCallback } from "react";
import DropZone from "../components/DropZone";
import ResultCard from "../components/ResultCard";
import { checkImage, getDatabase } from "../api/client";

export default function GatewayPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dbCount, setDbCount] = useState(0);
  const [checksToday, setChecksToday] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const data = await getDatabase();
      setDbCount(data.length);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const handleCheck = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await checkImage(file);
      setResult(data);
      setChecksToday((p) => p + 1);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to check image");
    } finally {
      setLoading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Instagram-style header */}
      <header className="border-b border-white/10 bg-[#0f0f0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Instagram gradient logo */}
            <div className="ig-gradient w-9 h-9 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" strokeWidth={1.5} />
                <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-white leading-tight">Instagram</h1>
              <p className="text-[10px] text-white/30">Create new post</p>
            </div>
          </div>

          {!result && file && (
            <button
              onClick={handleCheck}
              disabled={loading}
              className="px-5 py-1.5 rounded-lg bg-[#0095f6] hover:bg-[#1877f2] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Checking..." : "Share"}
            </button>
          )}
          {result && (
            <button
              onClick={resetUpload}
              className="px-5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
            >
              New Post
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-xl">

          {/* Upload area */}
          {!result && !loading && (
            <div className="animate-fade-in-scale">
              <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-linear-to-br from-amber-500 via-pink-500 to-purple-500 p-[2px]">
                    <div className="w-full h-full rounded-full bg-[#1a1a1a] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">U</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white/80">user_demo</span>
                </div>
                <div className="p-5">
                  <DropZone onFileSelect={setFile} variant="instagram" />
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="animate-fade-in-scale">
              <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-10 text-center">
                <div className="relative mx-auto w-16 h-16 mb-5">
                  <div className="absolute inset-0 rounded-full border-[3px] border-white/5" />
                  <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#0095f6] animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-purple-500/60 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                </div>
                <p className="text-base text-white/60 font-medium">Scanning your content</p>
                <p className="text-sm text-white/25 mt-2">
                  Checking against {dbCount} flagged entries...
                </p>
                <div className="mt-5 mx-auto max-w-[200px] h-1 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-[#0095f6] animate-shimmer" style={{ width: "100%" }} />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center animate-fade-in-up">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={resetUpload} className="mt-2 text-xs text-white/40 hover:text-white/60 underline">Try again</button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-0">
              <ResultCard result={result} />
            </div>
          )}
        </div>
      </main>

      {/* Footer - DigitalDome branding */}
      <footer className="border-t border-white/5 py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-linear-to-br from-red-500 to-blue-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xs text-white/25 font-medium">Protected by <span className="text-white/40">DigitalDome</span></span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-white/20">
            <span><span className="text-white/35 font-medium">{dbCount}</span> flagged entries</span>
            <span className="text-white/10">|</span>
            <span><span className="text-white/35 font-medium">{checksToday}</span> checked today</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
