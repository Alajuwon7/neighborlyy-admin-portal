import "@/app/globals.css";
import type { ReactNode } from "react";

export default function OffboardingPublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--nly-canvas)", color: "var(--nly-text-primary)" }}
    >
      <header
        className="border-b"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          <span
            className="text-base font-bold tracking-wider"
            style={{ color: "var(--nly-brand)" }}
          >
            MIYORA
          </span>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        {children}
      </main>
      <footer
        className="border-t text-xs"
        style={{
          borderColor: "var(--nly-border)",
          color: "var(--nly-text-tertiary)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          Miyora Admin Portal · support@miyora-app.com
        </div>
      </footer>
    </div>
  );
}
