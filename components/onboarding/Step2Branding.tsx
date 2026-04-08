import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { OnboardingTip } from "@/components/onboarding/OnboardingTip";
import { extractFromUrl } from "@/lib/url-extract";
import { CheckCircle2, Loader2 } from "lucide-react";

export interface Step2Data {
  primary_color: string;
  accent_color: string;
}

interface Props {
  data: Step2Data;
  communityName: string;
  websiteUrl?: string;
  onChange: (data: Partial<Step2Data>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Branding({ data, communityName, websiteUrl, onChange, onNext, onBack }: Props) {
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);

  // Auto-extract colors from website URL if available
  useEffect(() => {
    if (!websiteUrl || !websiteUrl.startsWith("http") || extracted) return;
    let cancelled = false;
    setExtracting(true);
    extractFromUrl(websiteUrl).then((site) => {
      if (cancelled) return;
      const updates: Partial<Step2Data> = {};
      if (site.primaryColor) updates.primary_color = site.primaryColor;
      if (site.accentColor) updates.accent_color = site.accentColor;
      if (Object.keys(updates).length > 0) {
        onChange(updates);
        setExtracted(true);
      }
      setExtracting(false);
    }).catch(() => { if (!cancelled) setExtracting(false); });
    return () => { cancelled = true; };
  }, [websiteUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preview card */}
      <div
        className="rounded-xl p-5 border"
        style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
      >
        <p className="text-xs font-medium mb-3" style={{ color: "var(--nly-text-tertiary)" }}>
          PREVIEW
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: data.primary_color }}
          >
            {communityName.charAt(0) || "N"}
          </div>
          <div>
            <p className="font-semibold" style={{ color: "var(--nly-text-primary)" }}>
              <span style={{ color: data.primary_color }}>Neighborlyy</span>{" "}
              <span style={{ color: "var(--nly-text-tertiary)" }}>@</span>{" "}
              {communityName || "Your Property"}
            </p>
            <p className="text-sm" style={{ color: data.accent_color }}>
              Community App
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: data.primary_color }}
          >
            Primary Button
          </button>
          <button
            type="button"
            className="px-4 py-1.5 rounded-lg text-sm font-medium border"
            style={{ color: data.accent_color, borderColor: data.accent_color }}
          >
            Secondary
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-3">
          <Label style={{ color: "var(--nly-text-primary)" }}>Primary Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.primary_color}
              onChange={(e) => onChange({ primary_color: e.target.value })}
              className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0.5"
              style={{ backgroundColor: "var(--nly-input-bg)" }}
            />
            <input
              type="text"
              value={data.primary_color}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange({ primary_color: v });
              }}
              className="flex-1 h-9 rounded-md border px-3 text-sm font-mono"
              style={{
                backgroundColor: "var(--nly-input-bg)",
                borderColor: "var(--nly-input-border)",
                color: "var(--nly-text-primary)",
              }}
              maxLength={7}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Used for buttons, headers, and key actions.
          </p>
        </div>

        <div className="space-y-3">
          <Label style={{ color: "var(--nly-text-primary)" }}>Accent Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.accent_color}
              onChange={(e) => onChange({ accent_color: e.target.value })}
              className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0.5"
              style={{ backgroundColor: "var(--nly-input-bg)" }}
            />
            <input
              type="text"
              value={data.accent_color}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange({ accent_color: v });
              }}
              className="flex-1 h-9 rounded-md border px-3 text-sm font-mono"
              style={{
                backgroundColor: "var(--nly-input-bg)",
                borderColor: "var(--nly-input-border)",
                color: "var(--nly-text-primary)",
              }}
              maxLength={7}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Used for links, focus rings, and secondary elements.
          </p>
        </div>
      </div>

      {/* Extraction status */}
      {extracting && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--nly-accent)" }}>
          <Loader2 size={13} className="animate-spin" />
          Extracting colors from your website...
        </div>
      )}
      {extracted && !extracting && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--nly-success)" }}>
          <CheckCircle2 size={13} />
          Extracted from your website — feel free to adjust
        </div>
      )}
      {!extracted && !extracting && (
        <OnboardingTip text="Most communities use their brand colors for a cohesive feel across the app" />
      )}

      {/* Quick presets */}
      <div className="space-y-2">
        <p className="text-xs font-medium" style={{ color: "var(--nly-text-tertiary)" }}>
          QUICK PRESETS
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { primary: "#E65C4F", accent: "#78A6C8", label: "Coral & Blue" },
            { primary: "#6366F1", accent: "#EC4899", label: "Indigo & Pink" },
            { primary: "#10B981", accent: "#3B82F6", label: "Emerald & Blue" },
            { primary: "#F59E0B", accent: "#EF4444", label: "Amber & Red" },
            { primary: "#8B5CF6", accent: "#06B6D4", label: "Purple & Cyan" },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                onChange({ primary_color: preset.primary, accent_color: preset.accent })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-opacity hover:opacity-80"
              style={{
                borderColor:
                  data.primary_color === preset.primary
                    ? preset.primary
                    : "var(--nly-border)",
                color: "var(--nly-text-secondary)",
                backgroundColor: "var(--nly-surface)",
              }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: preset.primary }}
              />
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: preset.accent }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

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
