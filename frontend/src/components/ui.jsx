import { createElement } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { cx, severityStyles } from "./uiConfig";

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  icon: Icon,
  ...props
}) {
  const variants = {
    primary: "border-sky-700 bg-sky-700 text-white hover:bg-sky-800 focus:ring-sky-200",
    danger: "border-red-600 bg-red-600 text-white hover:bg-red-700 focus:ring-red-200",
    success: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-200",
    secondary: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200",
    ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-200",
    warning: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-200",
  };
  const sizes = {
    sm: "h-8 px-2.5 text-xs",
    md: "h-10 px-3 text-sm",
    lg: "h-11 px-4 text-sm",
    icon: "h-9 w-9 p-0",
  };

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold shadow-sm transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {Icon && createElement(Icon, { className: "h-4 w-4", "aria-hidden": "true" })}
      {children}
    </button>
  );
}

export function Panel({ children, className }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, eyebrow, action, children, className }) {
  return (
    <div className={cx("border-b border-slate-200 px-4 py-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{eyebrow}</p>}
          <h2 className="mt-0.5 text-sm font-bold text-slate-950">{title}</h2>
          {children && <div className="mt-1 text-xs leading-relaxed text-slate-500">{children}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function Badge({ children, className, tone = "neutral" }) {
  const tones = {
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ value, map = severityStyles }) {
  const key = value || "none";
  return (
    <span className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", map[key] || "border-slate-200 bg-slate-50 text-slate-600")}>
      {value || "none"}
    </span>
  );
}

export function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
      {children}{required && <span className="text-red-500"> *</span>}
    </label>
  );
}

export function StatTile({ label, value, icon: Icon, tone = "sky" }) {
  const tones = {
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        {Icon && (
          <span className={cx("rounded-lg border p-1.5", tones[tone])}>
            {createElement(Icon, { className: "h-4 w-4", "aria-hidden": "true" })}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon = Search, action }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
        {createElement(Icon, { className: "h-7 w-7", "aria-hidden": "true" })}
      </div>
      <p className="mt-4 text-sm font-bold text-slate-700">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function InlineAlert({ children, tone = "red", icon: Icon = AlertTriangle }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return (
    <div className={cx("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", tones[tone])}>
      {createElement(Icon, { className: "mt-0.5 h-4 w-4 shrink-0", "aria-hidden": "true" })}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx("h-4 w-4 animate-spin", className)} aria-hidden="true" />;
}
