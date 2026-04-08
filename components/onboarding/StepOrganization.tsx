"use client";

import { useState } from "react";
import { Building2, User } from "lucide-react";

export interface StepOrgData {
  org_type: "individual" | "company";
  org_name: string;
}

interface StepOrganizationProps {
  data: StepOrgData;
  onChange: (data: Partial<StepOrgData>) => void;
  onNext: () => void;
}

export function StepOrganization({ data, onChange, onNext }: StepOrganizationProps) {
  const [error, setError] = useState("");

  const handleNext = () => {
    if (data.org_type === "company" && !data.org_name.trim()) {
      setError("Please enter your company or organization name.");
      return;
    }
    setError("");
    onNext();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        Tell us how you manage your properties so we can set up your account correctly.
      </p>

      {/* Type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            onChange({ org_type: "individual", org_name: "" });
            setError("");
          }}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 text-left"
          style={{
            borderColor:
              data.org_type === "individual"
                ? "var(--nly-brand)"
                : "var(--nly-border)",
            backgroundColor:
              data.org_type === "individual"
                ? "rgba(230, 92, 79, 0.06)"
                : "transparent",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor:
                data.org_type === "individual"
                  ? "rgba(230, 92, 79, 0.12)"
                  : "rgba(233, 238, 244, 0.08)",
            }}
          >
            <User
              size={22}
              style={{
                color:
                  data.org_type === "individual"
                    ? "var(--nly-brand)"
                    : "var(--nly-text-tertiary)",
              }}
            />
          </div>
          <div className="text-center">
            <p
              className="text-sm font-semibold"
              style={{
                color:
                  data.org_type === "individual"
                    ? "var(--nly-text-primary)"
                    : "var(--nly-text-secondary)",
              }}
            >
              Independent Manager
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--nly-text-tertiary)" }}>
              I manage properties on my own
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onChange({ org_type: "company" });
            setError("");
          }}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 text-left"
          style={{
            borderColor:
              data.org_type === "company"
                ? "var(--nly-brand)"
                : "var(--nly-border)",
            backgroundColor:
              data.org_type === "company"
                ? "rgba(230, 92, 79, 0.06)"
                : "transparent",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor:
                data.org_type === "company"
                  ? "rgba(230, 92, 79, 0.12)"
                  : "rgba(233, 238, 244, 0.08)",
            }}
          >
            <Building2
              size={22}
              style={{
                color:
                  data.org_type === "company"
                    ? "var(--nly-brand)"
                    : "var(--nly-text-tertiary)",
              }}
            />
          </div>
          <div className="text-center">
            <p
              className="text-sm font-semibold"
              style={{
                color:
                  data.org_type === "company"
                    ? "var(--nly-text-primary)"
                    : "var(--nly-text-secondary)",
              }}
            >
              Company / Corporation
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--nly-text-tertiary)" }}>
              We manage multiple properties as an organization
            </p>
          </div>
        </button>
      </div>

      {/* Company name input — shown only for company type */}
      {data.org_type === "company" && (
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Organization Name
          </label>
          <input
            type="text"
            value={data.org_name}
            onChange={(e) => {
              onChange({ org_name: e.target.value });
              if (error) setError("");
            }}
            placeholder="e.g., Atlantic Residential Partners"
            className="w-full h-10 px-3 rounded-xl text-sm outline-none transition-all"
            style={{
              backgroundColor: "var(--nly-input-bg)",
              border: `1px solid ${error ? "var(--nly-error)" : "var(--nly-input-border)"}`,
              color: "var(--nly-text-primary)",
            }}
          />
          {error && (
            <p className="text-xs" style={{ color: "var(--nly-error)" }}>
              {error}
            </p>
          )}
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={handleNext}
        className="nly-btn-glow w-full h-11 rounded-xl text-sm font-semibold text-white transition-all"
        style={{ backgroundColor: "var(--nly-brand)" }}
      >
        Continue
      </button>
    </div>
  );
}
