import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Download, FilterX, Image, Search, ShieldAlert, Sparkles } from "lucide-react";
import AppShell from "../components/AppShell";
import { getDatabase, getSimilarMemes, imageUrl, getImagePath } from "../api/client";
import {
  Button,
  EmptyState,
  FieldLabel,
  Panel,
  PanelHeader,
  Spinner,
  StatTile,
  StatusBadge,
} from "../components/ui";
import { cx, inputClass, platformStyles } from "../components/uiConfig";

const SEVERITY_LEVELS = ["high", "medium", "low", "none"];

function exportCSV(memes) {
  const headers = [
    "ID", "Severity", "Platform", "Poster", "Source URL", "Community",
    "Target Group", "Date Detected", "Description", "Why Harmful",
    "Coded Elements", "Origin Community", "pHash",
  ];
  const escape = (value) => {
    const stringValue = String(value ?? "");
    return stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")
      ? `"${stringValue.replace(/"/g, '""')}"`
      : stringValue;
  };
  const rows = memes.map((meme) => [
    meme.id,
    meme.context?.severity ?? "",
    meme.platform ?? "",
    meme.original_poster ?? "",
    meme.source_url ?? "",
    meme.community ?? "",
    meme.context?.target_group ?? "",
    meme.date_detected ?? "",
    meme.context?.what_it_depicts ?? "",
    meme.context?.why_harmful ?? "",
    (meme.context?.coded_elements ?? []).join("; "),
    meme.context?.origin_community ?? "",
    meme.phash ?? "",
  ]);
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `digitaldome_export_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function matchesSearch(meme, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const fields = [
    meme.context?.what_it_depicts,
    meme.context_notes,
    meme.original_poster,
    meme.community,
    meme.context?.target_group,
    meme.context?.origin_community,
    meme.context?.why_harmful,
    ...(meme.context?.coded_elements ?? []),
  ];
  return fields.some((field) => field && String(field).toLowerCase().includes(q));
}

function SortButton({ column, activeColumn, direction, onSort, children }) {
  const active = column === activeColumn;
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 text-left text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:text-slate-900"
    >
      {children}
      {createElement(Icon, { className: cx("h-3.5 w-3.5", active ? "text-sky-700" : "text-slate-300"), "aria-hidden": "true" })}
    </button>
  );
}

function ContextRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState([]);
  const [platformFilter, setPlatformFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortCol, setSortCol] = useState("date_detected");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedId, setExpandedId] = useState(null);
  const [similarResults, setSimilarResults] = useState(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await getDatabase();
      if (Array.isArray(data)) setMemes(data);
    } catch {
      /* keep current data visible */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const platforms = useMemo(
    () => [...new Set(memes.map((meme) => meme.platform).filter((platform) => platform && platform !== "Unknown"))].sort(),
    [memes],
  );

  const filtered = useMemo(() => {
    let result = memes;
    if (search) result = result.filter((meme) => matchesSearch(meme, search));
    if (severityFilter.length > 0) result = result.filter((meme) => severityFilter.includes(meme.context?.severity ?? "none"));
    if (platformFilter) result = result.filter((meme) => meme.platform === platformFilter);
    if (dateFrom) result = result.filter((meme) => meme.date_detected >= dateFrom);
    if (dateTo) result = result.filter((meme) => meme.date_detected <= dateTo);

    return [...result].sort((a, b) => {
      let av;
      let bv;
      switch (sortCol) {
        case "severity": {
          const order = { high: 0, medium: 1, low: 2, none: 3 };
          av = order[a.context?.severity] ?? 4;
          bv = order[b.context?.severity] ?? 4;
          break;
        }
        case "platform":
          av = (a.platform ?? "").toLowerCase();
          bv = (b.platform ?? "").toLowerCase();
          break;
        case "poster":
          av = (a.original_poster ?? "").toLowerCase();
          bv = (b.original_poster ?? "").toLowerCase();
          break;
        case "target":
          av = (a.context?.target_group ?? "").toLowerCase();
          bv = (b.context?.target_group ?? "").toLowerCase();
          break;
        case "date_detected":
          av = a.date_detected ?? "";
          bv = b.date_detected ?? "";
          break;
        default:
          av = a.id;
          bv = b.id;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [memes, search, severityFilter, platformFilter, dateFrom, dateTo, sortCol, sortDir]);

  const stats = useMemo(() => {
    const bySeverity = { high: 0, medium: 0, low: 0, none: 0 };
    memes.forEach((meme) => {
      const severity = meme.context?.severity ?? "none";
      if (severity in bySeverity) bySeverity[severity]++;
      else bySeverity.none++;
    });
    return { total: memes.length, ...bySeverity };
  }, [memes]);

  const toggleSeverity = (level) => {
    setSeverityFilter((prev) => (prev.includes(level) ? prev.filter((severity) => severity !== level) : [...prev, level]));
  };

  const clearFilters = () => {
    setSearch("");
    setSeverityFilter([]);
    setPlatformFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = Boolean(search || severityFilter.length > 0 || platformFilter || dateFrom || dateTo);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const handleFindSimilar = async (meme) => {
    setSimilarResults(null);
    setSimilarError(null);
    setSimilarLoading(true);
    try {
      const data = await getSimilarMemes(meme.id);
      setSimilarResults(data);
    } catch {
      setSimilarError("Failed to find similar images");
    } finally {
      setSimilarLoading(false);
    }
  };

  return (
    <AppShell
      title="Evidence"
      description="Search, filter, export, and inspect the flagged-content database used by the pre-upload gateway."
      metrics={[
        { label: "Flagged", value: stats.total },
        { label: "High", value: stats.high },
        { label: "Visible", value: filtered.length },
      ]}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Total flagged" value={stats.total} icon={ShieldAlert} tone="sky" />
          <StatTile label="High severity" value={stats.high} tone="red" />
          <StatTile label="Medium" value={stats.medium} tone="amber" />
          <StatTile label="Low" value={stats.low} tone="slate" />
          <StatTile label="Unrated" value={stats.none} tone="slate" />
        </div>

        <Panel>
          <PanelHeader eyebrow="Filters" title="Investigation controls" />
          <div className="grid gap-3 p-4 xl:grid-cols-[minmax(260px,1fr)_auto_auto_auto_auto_auto] xl:items-end">
            <div>
              <FieldLabel>Search</FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Content, poster, community, target..."
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>

            <div>
              <FieldLabel>Severity</FieldLabel>
              <div className="flex flex-wrap gap-1">
                {SEVERITY_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleSeverity(level)}
                    className={cx(
                      "h-10 rounded-lg border px-3 text-xs font-black uppercase tracking-wide transition",
                      severityFilter.includes(level)
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Platform</FieldLabel>
              <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)} className={`${inputClass} min-w-[150px]`}>
                <option value="">All platforms</option>
                {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
            </div>

            <div>
              <FieldLabel>From</FieldLabel>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={`${inputClass} min-w-[145px]`} />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={`${inputClass} min-w-[145px]`} />
            </div>

            <div className="flex gap-2">
              {hasFilters && <Button type="button" variant="secondary" size="lg" icon={FilterX} onClick={clearFilters}>Clear</Button>}
              <Button type="button" variant="primary" size="lg" icon={Download} disabled={filtered.length === 0} onClick={() => exportCSV(filtered)}>
                Export
              </Button>
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            eyebrow="Database"
            title="Flagged evidence"
            action={<span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{filtered.length} visible</span>}
          />

          <div className="overflow-x-auto">
            <div className="min-w-[1040px]">
              <div className="grid grid-cols-[64px_110px_120px_1fr_1fr_120px_1.2fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span />
                <SortButton column="severity" activeColumn={sortCol} direction={sortDir} onSort={handleSort}>Severity</SortButton>
                <SortButton column="platform" activeColumn={sortCol} direction={sortDir} onSort={handleSort}>Platform</SortButton>
                <SortButton column="poster" activeColumn={sortCol} direction={sortDir} onSort={handleSort}>Poster</SortButton>
                <SortButton column="target" activeColumn={sortCol} direction={sortDir} onSort={handleSort}>Target</SortButton>
                <SortButton column="date_detected" activeColumn={sortCol} direction={sortDir} onSort={handleSort}>Date</SortButton>
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Description</span>
              </div>

              {loading && (
                <div className="space-y-3 p-6">
                  {[...Array(6)].map((_, index) => <div key={index} className="h-16 animate-shimmer rounded-xl bg-slate-100" />)}
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <EmptyState
                  icon={Search}
                  title={memes.length === 0 ? "No evidence available" : "No results match these filters"}
                  description={memes.length === 0 ? "Ingest source images to populate the dashboard." : "Clear or adjust filters to broaden the evidence set."}
                  action={hasFilters ? <Button type="button" variant="secondary" icon={FilterX} onClick={clearFilters}>Clear filters</Button> : null}
                />
              )}

              {!loading && filtered.length > 0 && (
                <div className="max-h-[calc(100vh-430px)] divide-y divide-slate-100 overflow-y-auto">
                  {filtered.map((meme) => (
                    <div key={meme.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedId(expandedId === meme.id ? null : meme.id);
                          setSimilarResults(null);
                        }}
                        className="grid w-full grid-cols-[64px_110px_120px_1fr_1fr_120px_1.2fr] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          <img
                            src={imageUrl(getImagePath(meme))}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <StatusBadge value={meme.context?.severity ?? "none"} />
                        <StatusBadge value={meme.platform ?? "Unknown"} map={platformStyles} />
                        <span className="truncate text-sm font-semibold text-slate-700">{meme.original_poster ?? "Unknown"}</span>
                        <span className="truncate text-sm text-slate-600">{meme.context?.target_group ?? "-"}</span>
                        <span className="font-mono text-xs text-slate-500">{meme.date_detected ?? "-"}</span>
                        <span className="truncate text-sm text-slate-500">{meme.context?.what_it_depicts ?? meme.context_notes ?? "-"}</span>
                      </button>

                      {expandedId === meme.id && (
                        <div className="bg-slate-50 px-4 pb-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
                              <div>
                                <img
                                  src={imageUrl(getImagePath(meme))}
                                  alt=""
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                  className="h-44 w-full rounded-xl border border-slate-200 object-cover"
                                />
                                <p className="mt-2 truncate font-mono text-[11px] text-slate-400">pHash: {meme.phash}</p>
                              </div>

                              <div className="min-w-0 space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge value={meme.context?.severity ?? "none"} />
                                  <StatusBadge value={meme.platform ?? "Unknown"} map={platformStyles} />
                                  {meme.source_url && (
                                    <a href={meme.source_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-sky-700 underline-offset-2 hover:underline">
                                      Source link
                                    </a>
                                  )}
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <ContextRow label="What it depicts" value={meme.context?.what_it_depicts} />
                                  <ContextRow label="Why harmful" value={meme.context?.why_harmful} />
                                  <ContextRow label="Target group" value={meme.context?.target_group} />
                                  <ContextRow label="Origin community" value={meme.context?.origin_community} />
                                </div>

                                {meme.context?.coded_elements?.length > 0 && (
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Coded elements</p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {meme.context.coded_elements.map((element, index) => (
                                        <span key={`${element}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-600">
                                          {element}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {meme.context_notes && <ContextRow label="Analyst notes" value={meme.context_notes} />}

                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
                                  <span>Poster: <span className="font-bold text-slate-700">{meme.original_poster ?? "Unknown"}</span></span>
                                  <span>Community: <span className="font-bold text-slate-700">{meme.community || "Unclassified"}</span></span>
                                  <span>Detected: <span className="font-bold text-slate-700">{meme.date_detected || "-"}</span></span>
                                  <span>ID: <span className="font-mono font-bold text-slate-700">{meme.id}</span></span>
                                  <Button type="button" variant="secondary" size="sm" icon={Sparkles} disabled={similarLoading} onClick={() => handleFindSimilar(meme)}>
                                    {similarLoading ? "Searching..." : "Find similar"}
                                  </Button>
                                </div>

                                {similarResults && similarResults.source_id === meme.id && (
                                  <SimilarResults results={similarResults} error={similarError} />
                                )}
                                {similarError && (!similarResults || similarResults.source_id !== meme.id) && (
                                  <p className="text-sm font-semibold text-red-600">{similarError}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <span>Showing <span className="font-black text-slate-800">{filtered.length}</span>{filtered.length !== memes.length && <> of <span className="font-black text-slate-800">{memes.length}</span></>} entries</span>
              <span className="hidden items-center gap-1 sm:inline-flex"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Auto-refresh every 10s</span>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function SimilarResults({ results, error }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Similar images</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{results.total_similar} found</span>
      </div>
      {results.total_similar === 0 ? (
        <p className="text-sm text-slate-500">No similar images found in the database.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {results.results.map((result) => (
            <div key={result.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="h-28 overflow-hidden bg-slate-100">
                <img
                  src={imageUrl(result.thumbnail_url)}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">Match</span>
                  <span className={cx("font-black", result.similarity_score >= 80 ? "text-red-700" : result.similarity_score >= 60 ? "text-orange-700" : "text-amber-700")}>
                    {result.similarity_score}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cx("h-full rounded-full", result.similarity_score >= 80 ? "bg-red-600" : result.similarity_score >= 60 ? "bg-orange-500" : "bg-amber-500")}
                    style={{ width: `${result.similarity_score}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">Distance: {result.hamming_distance} bits</p>
                <p className="truncate text-xs font-semibold text-slate-700">{result.source || "Unknown source"}</p>
                {result.context?.severity && <StatusBadge value={result.context.severity} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}
