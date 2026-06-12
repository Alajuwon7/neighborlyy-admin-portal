"use client";

import { useEffect } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";

// Bare scheme opens the app at its start screen (login when signed out),
// which is exactly where a freshly confirmed user needs to be.
const APP_DEEP_LINK = "miyora://";

export default function EmailConfirmedPage() {
  useEffect(() => {
    // Try to bounce straight into the app; if it isn't installed the browser
    // ignores the navigation and the button below remains as the fallback.
    window.location.href = APP_DEEP_LINK;
  }, []);

  return (
    <AuthLayout>
      <div className="text-center space-y-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
          style={{ backgroundColor: "var(--nly-success-bg)", color: "var(--nly-success)" }}
        >
          ✓
        </div>

        <div className="space-y-2">
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Email Confirmed
          </h2>
          <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
            Your email address is verified. Head back to the Miyora app to
            sign in.
          </p>
        </div>

        <a
          href={APP_DEEP_LINK}
          className="flex items-center justify-center w-full h-11 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "var(--nly-brand-gradient)",
            color: "var(--nly-brand-text)",
          }}
        >
          Open the Miyora App
        </a>

        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          Nothing happening? Open the Miyora app on your phone and sign in
          there.
        </p>
      </div>
    </AuthLayout>
  );
}
