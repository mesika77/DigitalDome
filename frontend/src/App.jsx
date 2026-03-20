import { Component } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import GatewayPage from "./pages/GatewayPage";
import AdminPage from "./pages/AdminPage";

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 ring-1 ring-red-500/20">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-white/60 text-sm font-medium mb-1">Something went wrong</p>
            <p className="text-white/30 text-xs mb-4">The page encountered an error.</p>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false })}
              className="inline-block px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white/70 transition-colors"
            >
              Back to Gateway
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
        <Routes>
          <Route path="/" element={<GatewayPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
