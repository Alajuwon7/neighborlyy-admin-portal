import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Step4Data {
  admin_code: string;
}

interface Props {
  data: Step4Data;
  onChange: (data: Partial<Step4Data>) => void;
  onNext: () => void;
  onBack: () => void;
}

const inputStyle = {
  backgroundColor: "var(--nly-input-bg)",
  borderColor: "var(--nly-input-border)",
  color: "var(--nly-text-primary)",
};

export function Step4AdminAccess({ data, onChange, onNext, onBack }: Props) {
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onChange({ admin_code: code });
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.admin_code) {
      setError("Admin code is required.");
      toast.error("Please enter an admin code.");
      return;
    }
    if (data.admin_code.length < 6) {
      setError(`Admin code must be at least 6 characters (currently ${data.admin_code.length}).`);
      toast.error("Admin code must be at least 6 characters.");
      return;
    }
    setError("");
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        className="rounded-xl p-4 border"
        style={{
          backgroundColor: "rgba(120, 166, 200, 0.08)",
          borderColor: "rgba(120, 166, 200, 0.2)",
        }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: "var(--nly-accent)" }}>
          What is an Admin Code?
        </p>
        <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
          Property managers use this code to approve residents joining your community.
          Share it with your leasing team — residents{" "}
          <strong style={{ color: "var(--nly-text-primary)" }}>never</strong> see this code.
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="adminCode" style={{ color: "var(--nly-text-primary)" }}>Admin Code *</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="adminCode"
              required
              type={showCode ? "text" : "password"}
              minLength={6}
              maxLength={12}
              placeholder="e.g. SUNSET24"
              value={data.admin_code}
              onChange={(e) => {
                onChange({
                  admin_code: e.target.value.toUpperCase().replace(/\s/g, ""),
                });
                if (error) setError("");
              }}
              style={{ ...inputStyle, letterSpacing: showCode ? "0.1em" : "0.25em" }}
              className="font-mono pr-12"
            />
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              {showCode ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="button"
            onClick={generateCode}
            className="px-3 h-9 rounded-lg border text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              borderColor: "var(--nly-border)",
              color: "var(--nly-text-secondary)",
              backgroundColor: "var(--nly-surface)",
            }}
          >
            Generate
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          Min 6 characters. Letters and numbers only.
        </p>
        {error && (
          <p className="text-xs font-medium" style={{ color: "var(--nly-error, #ef4444)" }}>
            {error}
          </p>
        )}
      </div>

      {data.admin_code && (
        <div
          className="rounded-xl p-4 border space-y-1"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p className="text-xs font-medium" style={{ color: "var(--nly-text-tertiary)" }}>
            YOUR ADMIN CODE
          </p>
          <p
            className="text-2xl font-mono font-bold tracking-widest"
            style={{ color: "var(--nly-brand)" }}
          >
            {data.admin_code}
          </p>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Keep this safe. You can change it anytime in Settings.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-11 rounded-lg font-semibold text-sm border transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-secondary)",
            backgroundColor: "transparent",
          }}
        >
          ← Back
        </button>
        <button
          type="submit"
          className="flex-1 h-11 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
        >
          Continue →
        </button>
      </div>
    </form>
  );
}
