import { NavLink } from "react-router-dom";
import { createElement } from "react";
import { Database, Gauge, Network, ScanLine } from "lucide-react";
import { cx } from "./uiConfig";

const navItems = [
  { to: "/", label: "Ingestion", icon: Database, end: true },
  { to: "/gateway", label: "Scan", icon: ScanLine },
  { to: "/dashboard", label: "Evidence", icon: Gauge },
  { to: "/dataflows", label: "Dataflows", icon: Network },
];

export default function AppShell({ title, description, metrics = [], children }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/brand/digitaldome-logo.jpeg"
              alt="DigitalDome logo"
              className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-white object-contain shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">DigitalDome</p>
              <h1 className="truncate text-base font-black tracking-tight text-slate-950">{title}</h1>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-inner md:flex">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold transition",
                    isActive ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-800",
                  )
                }
              >
                {createElement(Icon, { className: "h-4 w-4", "aria-hidden": "true" })}
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center justify-end gap-2 xl:flex">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                <p className="text-sm font-black text-slate-950">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="mx-auto grid max-w-[1440px] grid-cols-4 gap-1 px-4 py-2">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    "flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-bold transition",
                    isActive ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100",
                  )
                }
              >
                {createElement(Icon, { className: "h-4 w-4", "aria-hidden": "true" })}
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Operations console</p>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
          </div>
          {metrics.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:flex xl:hidden">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                  <p className="text-sm font-black text-slate-950">{metric.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {children}
      </main>
    </div>
  );
}
