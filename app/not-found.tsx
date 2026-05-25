import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--nly-background)", color: "var(--nly-text-primary)" }}
    >
      <div className="text-center max-w-md space-y-6">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl text-3xl font-bold"
          style={{ backgroundColor: "var(--nly-surface)", color: "var(--nly-brand)" }}
        >
          404
        </div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
