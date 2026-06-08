export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const severityStyles = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-orange-200 bg-orange-50 text-orange-700",
  low: "border-amber-200 bg-amber-50 text-amber-700",
  none: "border-slate-200 bg-slate-50 text-slate-500",
};

export const platformStyles = {
  Reddit: "border-orange-200 bg-orange-50 text-orange-700",
  "4chan": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Telegram: "border-sky-200 bg-sky-50 text-sky-700",
  "Twitter/X": "border-blue-200 bg-blue-50 text-blue-700",
  Discord: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Gab: "border-teal-200 bg-teal-50 text-teal-700",
};

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export const smallInputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
