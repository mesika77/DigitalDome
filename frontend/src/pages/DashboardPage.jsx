import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { getDatabase, imageUrl } from "../api/client";

const SEVERITY_LEVELS = ["high", "medium", "low", "none"];

const SEVERITY_STYLES = {
  high: "bg-red-500/10 text-red-400 ring-red-500/15",
  medium: "bg-orange-500/10 text-orange-400 ring-orange-500/15",
  low: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/15",
  none: "bg-white/5 text-white/40 ring-white/10",
};

const PLATFORM_COLORS = {
  Reddit: "bg-orange-500/10 text-orange-400 ring-orange-500/15",
  "4chan": "bg-green-500/10 text-green-400 ring-green-500/15",
  Telegram: "bg-blue-500/10 text-blue-400 ring-blue-500/15",
  "Twitter/X": "bg-sky-500/10 text-sky-400 ring-sky-500/15",
  Discord: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/15",
  Gab: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/15",
};

function Badge({ label, colorClass }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${colorClass}`}
    >
      {label}
    </span>
  );
}

function SortIcon({ active, direction }) {
  if (!active)
    return (
      <svg className="w-3 h-3 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  return (
    <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={direction === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
      />
    </svg>
  );
}

function exportCSV(memes) {
  const headers = [
    "ID", "Severity", "Platform", "Poster", "Source URL", "Community",
    "Target Group", "Date Detected", "Description", "Why Harmful",
    "Coded Elements", "Origin Community", "pHash",
  ];
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = memes.map((m) => [
    m.id,
    m.context?.severity ?? "",
    m.platform ?? "",
    m.original_poster ?? "",
    m.source_url ?? "",
    m.community ?? "",
    m.context?.target_group ?? "",
    m.date_detected ?? "",
    m.context?.what_it_depicts ?? "",
    m.context?.why_harmful ?? "",
    (m.context?.coded_elements ?? []).join("; "),
    m.context?.origin_community ?? "",
    m.phash ?? "",
  ]);
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `digitaldome_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
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
  return fields.some((f) => f && String(f).toLowerCase().includes(q));
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

  const fetchData = useCallback(async () => {
    try {
      const data = await getDatabase();
      if (Array.isArray(data)) setMemes(data);
    } catch {
      /* silent */
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
    () => [...new Set(memes.map((m) => m.platform).filter((p) => p && p !== "Unknown"))].sort(),
    [memes],
  );

  const filtered = useMemo(() => {
    let result = memes;

    if (search) result = result.filter((m) => matchesSearch(m, search));

    if (severityFilter.length > 0)
      result = result.filter((m) => severityFilter.includes(m.context?.severity ?? "none"));

    if (platformFilter) result = result.filter((m) => m.platform === platformFilter);

    if (dateFrom)
      result = result.filter((m) => m.date_detected >= dateFrom);
    if (dateTo)
      result = result.filter((m) => m.date_detected <= dateTo);

    result = [...result].sort((a, b) => {
      let av, bv;
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

    return result;
  }, [memes, search, severityFilter, platformFilter, dateFrom, dateTo, sortCol, sortDir]);

  const stats = useMemo(() => {
    const bySeverity = { high: 0, medium: 0, low: 0, none: 0 };
    memes.forEach((m) => {
      const s = m.context?.severity ?? "none";
      if (s in bySeverity) bySeverity[s]++;
      else bySeverity.none++;
    });
    return { total: memes.length, ...bySeverity };
  }, [memes]);

  const toggleSeverity = (level) => {
    setSeverityFilter((prev) =>
      prev.includes(level) ? prev.filter((s) => s !== level) : [...prev, level],
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSeverityFilter([]);
    setPlatformFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = search || severityFilter.length > 0 || platformFilter || dateFrom || dateTo;

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const inputClass =
    "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-violet-500/40 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight tracking-tight">
                DigitalDome
              </h1>
              <p className="text-[10px] text-white/25">Law Enforcement Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Gateway
            </Link>
            <Link
              to="/admin"
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Intel Console
            </Link>
            <span className="px-3 py-1.5 rounded-lg bg-violet-500/15 text-xs text-violet-400 font-medium ring-1 ring-violet-500/20">
              Dashboard
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-6 flex flex-col gap-5">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-scale">
          <StatCard label="Total Flagged" value={stats.total} accent="violet" />
          <StatCard label="High Severity" value={stats.high} accent="red" />
          <StatCard label="Medium" value={stats.medium} accent="orange" />
          <StatCard label="Low" value={stats.low} accent="yellow" />
          <StatCard label="None" value={stats.none} accent="gray" />
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-white/5 bg-white/1.5 p-4 animate-fade-in-up">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">
                Search
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search content, posters, communities, targets..."
                  className={`${inputClass} w-full pl-9`}
                />
              </div>
            </div>

            {/* Severity toggles */}
            <div>
              <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">
                Severity
              </label>
              <div className="flex gap-1">
                {SEVERITY_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => toggleSeverity(level)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold uppercase transition-all ${
                      severityFilter.includes(level)
                        ? level === "high"
                          ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                          : level === "medium"
                            ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30"
                            : level === "low"
                              ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30"
                              : "bg-white/10 text-white/60 ring-1 ring-white/20"
                        : "bg-white/5 text-white/30 hover:bg-white/8 hover:text-white/50"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">
                Platform
              </label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className={`${inputClass} appearance-none pr-8 min-w-[130px]`}
              >
                <option value="" className="bg-[#1a1a1a]">All</option>
                {platforms.map((p) => (
                  <option key={p} value={p} className="bg-[#1a1a1a]">{p}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`${inputClass} min-w-[130px]`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wider">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`${inputClass} min-w-[130px]`}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => exportCSV(filtered)}
                disabled={filtered.length === 0}
                className="px-3 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-xs text-white font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-2xl border border-white/5 bg-white/1.5 overflow-hidden flex-1">
          {/* Column headers */}
          <div className="grid grid-cols-[56px_90px_100px_1fr_1fr_100px_1fr] gap-2 px-4 py-2.5 border-b border-white/5 bg-white/2">
            <span className="text-[10px] text-white/25 uppercase tracking-wider" />
            <button onClick={() => handleSort("severity")} className="flex items-center gap-1 text-[10px] text-white/25 uppercase tracking-wider hover:text-white/40 transition-colors text-left">
              Severity <SortIcon active={sortCol === "severity"} direction={sortDir} />
            </button>
            <button onClick={() => handleSort("platform")} className="flex items-center gap-1 text-[10px] text-white/25 uppercase tracking-wider hover:text-white/40 transition-colors text-left">
              Platform <SortIcon active={sortCol === "platform"} direction={sortDir} />
            </button>
            <button onClick={() => handleSort("poster")} className="flex items-center gap-1 text-[10px] text-white/25 uppercase tracking-wider hover:text-white/40 transition-colors text-left">
              Poster <SortIcon active={sortCol === "poster"} direction={sortDir} />
            </button>
            <button onClick={() => handleSort("target")} className="flex items-center gap-1 text-[10px] text-white/25 uppercase tracking-wider hover:text-white/40 transition-colors text-left">
              Target Group <SortIcon active={sortCol === "target"} direction={sortDir} />
            </button>
            <button onClick={() => handleSort("date_detected")} className="flex items-center gap-1 text-[10px] text-white/25 uppercase tracking-wider hover:text-white/40 transition-colors text-left">
              Date <SortIcon active={sortCol === "date_detected"} direction={sortDir} />
            </button>
            <span className="text-[10px] text-white/25 uppercase tracking-wider">Description</span>
          </div>

          {/* Loading shimmer */}
          {loading && (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-white/3 animate-shimmer" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="p-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <svg className="h-7 w-7 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm text-white/30 font-medium">
                {memes.length === 0 ? "No intelligence data available" : "No results match your filters"}
              </p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs text-violet-400/70 hover:text-violet-400 underline transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Rows */}
          {!loading && filtered.length > 0 && (
            <div className="divide-y divide-white/5 max-h-[calc(100vh-360px)] overflow-y-auto">
              {filtered.map((meme) => (
                <div key={meme.id}>
                  <button
                    onClick={() => setExpandedId(expandedId === meme.id ? null : meme.id)}
                    className="w-full grid grid-cols-[56px_90px_100px_1fr_1fr_100px_1fr] gap-2 px-4 py-2.5 items-center hover:bg-white/2 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/30 border border-white/5">
                      <img
                        src={imageUrl(meme.thumbnail_url)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Badge
                      label={meme.context?.severity ?? "n/a"}
                      colorClass={SEVERITY_STYLES[meme.context?.severity] ?? SEVERITY_STYLES.none}
                    />
                    <Badge
                      label={meme.platform ?? "Unknown"}
                      colorClass={PLATFORM_COLORS[meme.platform] ?? "bg-white/5 text-white/40 ring-white/10"}
                    />
                    <span className="text-xs text-white/60 truncate">
                      {meme.original_poster ?? "Unknown"}
                    </span>
                    <span className="text-xs text-white/50 truncate">
                      {meme.context?.target_group ?? "—"}
                    </span>
                    <span className="text-xs text-white/40 font-mono">
                      {meme.date_detected ?? "—"}
                    </span>
                    <span className="text-xs text-white/40 truncate">
                      {meme.context?.what_it_depicts ?? meme.context_notes ?? "—"}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {expandedId === meme.id && (
                    <div className="px-4 pb-4 animate-fade-in-up">
                      <div className="rounded-xl border border-violet-500/10 bg-violet-500/5 p-4">
                        <div className="flex gap-5">
                          <div className="shrink-0">
                            <img
                              src={imageUrl(meme.thumbnail_url)}
                              alt=""
                              className="w-40 h-40 rounded-xl object-cover border border-white/10"
                            />
                            <p className="text-[10px] text-white/20 font-mono mt-1.5 truncate max-w-[160px]">
                              pHash: {meme.phash}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                label={meme.context?.severity ?? "n/a"}
                                colorClass={SEVERITY_STYLES[meme.context?.severity] ?? SEVERITY_STYLES.none}
                              />
                              <Badge
                                label={meme.platform ?? "Unknown"}
                                colorClass={PLATFORM_COLORS[meme.platform] ?? "bg-white/5 text-white/40 ring-white/10"}
                              />
                              {meme.source_url && (
                                <a
                                  href={meme.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-violet-400/70 hover:text-violet-400 underline transition-colors"
                                >
                                  Source link
                                </a>
                              )}
                            </div>

                            <ContextRow label="What it depicts" value={meme.context?.what_it_depicts} />
                            <ContextRow label="Why harmful" value={meme.context?.why_harmful} />
                            <ContextRow label="Target group" value={meme.context?.target_group} />
                            <ContextRow label="Origin community" value={meme.context?.origin_community} />

                            {meme.context?.coded_elements?.length > 0 && (
                              <div>
                                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">
                                  Coded Elements
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {meme.context.coded_elements.map((el, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300 ring-1 ring-violet-500/15"
                                    >
                                      {el}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {meme.context_notes && (
                              <ContextRow label="Analyst notes" value={meme.context_notes} />
                            )}

                            <div className="flex items-center gap-4 pt-1 text-[10px] text-white/20">
                              <span>Poster: <span className="text-white/40">{meme.original_poster ?? "Unknown"}</span></span>
                              <span>Community: <span className="text-white/40">{meme.community}</span></span>
                              <span>Detected: <span className="text-white/40">{meme.date_detected}</span></span>
                              <span>ID: <span className="text-white/40 font-mono">{meme.id}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer bar */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 bg-white/2 flex items-center justify-between">
              <span className="text-[11px] text-white/25">
                Showing <span className="text-white/40 font-semibold">{filtered.length}</span>
                {filtered.length !== memes.length && (
                  <> of <span className="text-white/40 font-semibold">{memes.length}</span></>
                )}{" "}
                entries
              </span>
              <span className="text-[10px] text-white/15">DigitalDome Threat Intelligence</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accents = {
    violet: "from-violet-500/10 to-indigo-500/10 ring-violet-500/15",
    red: "from-red-500/10 to-red-500/5 ring-red-500/15",
    orange: "from-orange-500/10 to-orange-500/5 ring-orange-500/15",
    yellow: "from-yellow-500/10 to-yellow-500/5 ring-yellow-500/15",
    gray: "from-white/5 to-white/3 ring-white/10",
  };
  const textAccents = {
    violet: "text-violet-400",
    red: "text-red-400",
    orange: "text-orange-400",
    yellow: "text-yellow-400",
    gray: "text-white/50",
  };
  return (
    <div className={`rounded-xl bg-linear-to-br ${accents[accent]} ring-1 p-3.5`}>
      <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${textAccents[accent]}`}>{value}</p>
    </div>
  );
}

function ContextRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-white/60 leading-relaxed">{value}</p>
    </div>
  );
}
