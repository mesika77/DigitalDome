import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Database, RefreshCcw, ScanLine, ShieldCheck, UploadCloud } from "lucide-react";
import AppShell from "../components/AppShell";
import DropZone from "../components/DropZone";
import ResultCard from "../components/ResultCard";
import { checkImage, getDatabase } from "../api/client";
import { Button, InlineAlert, Panel, PanelHeader, Spinner, StatTile } from "../components/ui";

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
      if (Array.isArray(data)) setDbCount(data.length);
    } catch {
      /* scanner still works if count refresh fails */
    }
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
      setChecksToday((previous) => previous + 1);
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to analyze content";
      if (err.response?.status === 429 || err.response?.status === 503) toast.error(detail);
      setError(detail);
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
    <AppShell
      title="Scan"
      description="Check a single upload against the evidence database and AI content analysis before a publishing decision."
      metrics={[
        { label: "Flagged entries", value: dbCount },
        { label: "Scans this session", value: checksToday },
      ]}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Evidence" value={dbCount} icon={Database} tone="sky" />
            <StatTile label="Session scans" value={checksToday} icon={ShieldCheck} tone="emerald" />
          </div>

          <Panel>
            <PanelHeader eyebrow="Pre-upload gateway" title="Scan candidate content">
              Select one image, run analysis, and review the decision evidence returned by the backend.
            </PanelHeader>
            <div className="space-y-4 p-4">
              {!result && !loading && <DropZone onFileSelect={setFile} disabled={loading} />}

              {loading && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-200">
                    <Spinner className="h-8 w-8" />
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-900">Scanning content</p>
                  <p className="mt-1 text-sm text-slate-600">Checking against {dbCount} flagged entries and AI analysis.</p>
                  <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-white">
                    <div className="h-full w-full animate-shimmer rounded-full bg-sky-600" />
                  </div>
                </div>
              )}

              {error && (
                <InlineAlert>
                  <div className="flex flex-col gap-2">
                    <span>{error}</span>
                    <Button type="button" variant="secondary" size="sm" onClick={resetUpload}>
                      Try again
                    </Button>
                  </div>
                </InlineAlert>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                {!result && file && (
                  <Button type="button" variant="primary" size="lg" icon={ScanLine} disabled={loading} onClick={handleCheck} className="flex-1">
                    Analyze upload
                  </Button>
                )}
                {(result || file) && (
                  <Button type="button" variant="secondary" size="lg" icon={RefreshCcw} onClick={resetUpload} className="flex-1">
                    New scan
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div>
          {result ? (
            <ResultCard result={result} />
          ) : (
            <Panel>
              <PanelHeader eyebrow="Decision output" title="Scan evidence appears here" />
              <div className="p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                  <UploadCloud className="h-8 w-8" aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-bold text-slate-700">No decision yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Upload an image and run analysis to see approval, review, or block details.</p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
