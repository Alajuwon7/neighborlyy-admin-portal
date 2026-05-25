"use client";

import { useState } from "react";
import { submitCorpDecision } from "./actions";

interface CorpApprovalFormProps {
  token: string;
  pmName: string;
  orgName: string;
  communityNames: string[];
  reason: string | null;
  requestedAt: string;
}

export function CorpApprovalForm({
  token,
  pmName,
  orgName,
  communityNames,
  reason,
  requestedAt,
}: CorpApprovalFormProps) {
  const [approverName, setApproverName] = useState("");
  const [approverTitle, setApproverTitle] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolved, setResolved] = useState<"approved" | "denied" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(decision: "approve" | "deny") {
    if (!approverName.trim() || !approverTitle.trim() || !approverEmail.trim()) {
      setError("Please enter your full name, title, and email.");
      return;
    }
    if (!authorized) {
      setError("Please confirm you are authorized to make this decision.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await submitCorpDecision({
      token,
      decision,
      approverName,
      approverTitle,
      approverEmail,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResolved(result.decision);
  }

  if (resolved === "approved") {
    return (
      <ResultPanel
        tone="success"
        title="Approved"
        body="The property manager will be notified and the offboarding process will continue. You can close this page."
      />
    );
  }
  if (resolved === "denied") {
    return (
      <ResultPanel
        tone="warning"
        title="Request denied"
        body="The property manager has been notified. No changes have been made to their account."
      />
    );
  }

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          A property manager has requested to close their Miyora account
        </h1>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          This request requires your authorization. The PM&apos;s account will not
          be changed until you approve.
        </p>
      </header>

      <section
        className="rounded-2xl border p-5 space-y-3 text-sm"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Request details
        </h2>
        <Detail label="PM name" value={pmName} />
        <Detail label="Organization" value={orgName} />
        <Detail
          label="Communities"
          value={
            communityNames.length
              ? communityNames.join(", ")
              : "(none on file)"
          }
        />
        <Detail
          label="Request date"
          value={new Date(requestedAt).toLocaleString()}
        />
        <Detail label="Reason" value={reason ?? "Not provided"} />
      </section>

      <section
        className="rounded-2xl border p-5 space-y-4"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--nly-text-primary)" }}
        >
          Your details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1 text-xs">
            <span style={{ color: "var(--nly-text-secondary)" }}>
              Full name *
            </span>
            <input
              type="text"
              className="w-full h-9 rounded-lg border px-3 text-sm"
              style={inputStyle}
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span style={{ color: "var(--nly-text-secondary)" }}>
              Your title *
            </span>
            <input
              type="text"
              className="w-full h-9 rounded-lg border px-3 text-sm"
              style={inputStyle}
              value={approverTitle}
              onChange={(e) => setApproverTitle(e.target.value)}
              autoComplete="organization-title"
            />
          </label>
          <label className="space-y-1 text-xs md:col-span-2">
            <span style={{ color: "var(--nly-text-secondary)" }}>
              Your work email *
            </span>
            <input
              type="email"
              className="w-full h-9 rounded-lg border px-3 text-sm"
              style={inputStyle}
              value={approverEmail}
              onChange={(e) => setApproverEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
        </div>
        <label
          className="flex items-start gap-2 text-xs"
          style={{ color: "var(--nly-text-secondary)" }}
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
          />
          <span>
            I am authorized to make decisions about this property&apos;s
            Miyora account and I confirm this decision.
          </span>
        </label>

        {error && (
          <p
            className="text-xs"
            style={{ color: "var(--nly-error)" }}
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse md:flex-row gap-3 pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("deny")}
            className="flex-1 h-10 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              borderColor: "var(--nly-error)",
              color: "var(--nly-error)",
              backgroundColor: "transparent",
            }}
          >
            Deny this request
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit("approve")}
            className="flex-1 h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            {submitting ? "Submitting..." : "Approve deletion request"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span
        className="text-xs font-medium"
        style={{ color: "var(--nly-text-tertiary)" }}
      >
        {label}
      </span>
      <span style={{ color: "var(--nly-text-primary)" }}>{value}</span>
    </div>
  );
}

function ResultPanel({
  tone,
  title,
  body,
}: {
  tone: "success" | "warning";
  title: string;
  body: string;
}) {
  const color =
    tone === "success" ? "var(--nly-success)" : "var(--nly-warning)";
  return (
    <div
      className="rounded-2xl border p-6 text-center space-y-3"
      style={{
        backgroundColor: "var(--nly-surface)",
        borderColor: "var(--nly-border)",
      }}
    >
      <h1 className="text-xl font-bold" style={{ color }}>
        {title}
      </h1>
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        {body}
      </p>
    </div>
  );
}
