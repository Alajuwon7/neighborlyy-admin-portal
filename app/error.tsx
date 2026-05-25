"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--nly-background)", color: "var(--nly-text-primary)" }}
    >
      <div className="text-center max-w-md space-y-6">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl text-2xl"
          style={{ backgroundColor: "var(--nly-error-bg)", color: "var(--nly-error)" }}
        >
          !
        </div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs font-mono" style={{ color: "var(--nly-text-tertiary)" }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={() => unstable_retry()}
          className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
