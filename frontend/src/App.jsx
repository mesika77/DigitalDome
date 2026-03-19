import { useState, useEffect, useCallback } from "react";
import SourcePanel from "./components/SourcePanel";
import GatewayPanel from "./components/GatewayPanel";
import { getDatabase } from "./api/client";

export default function App() {
  const [memes, setMemes] = useState([]);
  const [checksToday, setChecksToday] = useState(0);

  const fetchMemes = useCallback(async () => {
    try {
      const data = await getDatabase();
      setMemes(data);
    } catch {
      // silently retry on next poll
    }
  }, []);

  useEffect(() => {
    fetchMemes();
    const interval = setInterval(fetchMemes, 5000);
    return () => clearInterval(interval);
  }, [fetchMemes]);

  const handleCheckComplete = () => {
    setChecksToday((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-linear-to-br from-red-500 to-blue-600 flex items-center justify-center">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              DigitalDome
            </h1>
          </div>
          <p className="text-xs text-white/30 mt-1">
            Pre-upload hate content gateway
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
            <span>
              <span className="text-white/60 font-semibold">{memes.length}</span>{" "}
              memes in database
            </span>
            <span className="text-white/10">|</span>
            <span>
              <span className="text-white/60 font-semibold">{checksToday}</span>{" "}
              uploads checked today
            </span>
          </div>
        </div>
      </header>

      {/* Panels */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          <SourcePanel memes={memes} onMemeAdded={fetchMemes} />
          <GatewayPanel onCheckComplete={handleCheckComplete} />
        </div>
      </main>
    </div>
  );
}
