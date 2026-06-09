import { Component } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import GatewayPage from "./pages/GatewayPage";
import AdminPage from "./pages/AdminPage";
import DashboardPage from "./pages/DashboardPage";
import DataflowsPage from "./pages/DataflowsPage";

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mb-1 text-sm font-black text-slate-900">Something went wrong</p>
            <p className="mb-5 text-sm text-slate-500">The page encountered an error.</p>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false })}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to ingestion
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              fontSize: "14px",
              boxShadow: "0 16px 40px rgba(15,23,42,0.14)",
            },
            error: {
              duration: 5000,
              style: {
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
              },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<AdminPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/gateway" element={<GatewayPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dataflows" element={<DataflowsPage />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
