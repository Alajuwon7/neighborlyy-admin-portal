"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    router.refresh();
    // Keep spinner visible briefly so user sees feedback
    setTimeout(() => setSpinning(false), 800);
  }

  return (
    <button
      onClick={handleRefresh}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
      style={{
        borderColor: "var(--nly-border)",
        color: "var(--nly-text-secondary)",
        backgroundColor: "transparent",
      }}
      title="Refresh data"
    >
      <RefreshCw
        size={13}
        className={spinning ? "animate-spin" : ""}
      />
      Refresh
    </button>
  );
}
