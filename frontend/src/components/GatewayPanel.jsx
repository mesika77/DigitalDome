import { useState } from "react";
import DropZone from "./DropZone";
import ResultCard from "./ResultCard";
import { checkImage } from "../api/client";

export default function GatewayPanel({ onCheckComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCheck = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await checkImage(file);
      setResult(data);
      onCheckComplete?.();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to check image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-blue-500/10 bg-blue-500/2 p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">
          Instagram Gateway
        </h2>
        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">
          Pre-upload Check
        </span>
      </div>

      <DropZone onFileSelect={setFile} accent="blue" disabled={loading} />

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      <button
        onClick={handleCheck}
        disabled={!file || loading}
        className="mt-4 w-full rounded-lg bg-linear-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Scanning Content...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Post to Instagram
          </>
        )}
      </button>

      <div className="mt-5 flex-1 overflow-y-auto">
        {loading && !result && (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in-scale">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
            </div>
            <p className="mt-4 text-sm text-white/40">
              Analyzing image against database...
            </p>
            <p className="mt-1 text-xs text-white/20">
              Computing perceptual hash &amp; running AI analysis
            </p>
          </div>
        )}
        <ResultCard result={result} />
      </div>
    </div>
  );
}
