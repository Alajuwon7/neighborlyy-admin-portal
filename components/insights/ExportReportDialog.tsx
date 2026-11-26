"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { MAX_CUSTOM_DAYS, REPORT_PRESETS } from "@/lib/report-period";

type Choice = `${(typeof REPORT_PRESETS)[number]}` | "custom";

const CHOICES: { value: Choice; label: string }[] = [
  ...REPORT_PRESETS.map((d) => ({ value: `${d}` as Choice, label: `${d} days` })),
  { value: "custom", label: "Custom" },
];

/** Local calendar day as YYYY-MM-DD (date inputs work in local days). */
function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ExportReportDialog({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const today = localDay(new Date());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({ range: choice });
    if (choice === "custom") {
      if (!from || !to) {
        toast.error("Choose a start and end date.");
        return;
      }
      if (from > to) {
        toast.error("The start date must be on or before the end date.");
        return;
      }
      params.set("from", from);
      params.set("to", to);
    }
    params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);

    setLoading(true);
    try {
      const res = await fetch(`/dashboard/communities/${communityId}/insights/export?${params}`);
      if (!res.ok || res.headers.get("Content-Type") !== "application/pdf") {
        // 400s carry a friendly message; anything else gets a generic one.
        const msg = res.status === 400 ? await res.text() : "";
        toast.error(msg || "Couldn't build the report. Please try again.");
        return;
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "miyora-insights.pdf";
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      toast.success("Report downloaded");
      setOpen(false);
    } catch (err) {
      console.error("insights export failed:", err);
      toast.error("Couldn't build the report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors hover:bg-[var(--nly-surface-hover)]"
        style={{ borderColor: "var(--nly-border)", backgroundColor: "var(--nly-surface)", color: "var(--nly-text-primary)" }}
      >
        <FileDown size={14} />
        Export PDF
      </DialogTrigger>
      <DialogContent
        className="border sm:max-w-md overflow-x-hidden [&>*]:min-w-0"
        style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--nly-text-primary)" }}>Export insights report</DialogTitle>
        </DialogHeader>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          A printable PDF with activity, applications, events with RSVPs, and help requests for the period you choose.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2" style={{ color: "var(--nly-text-secondary)" }}>
              Period
            </legend>
            <div className="flex flex-wrap gap-2">
              {CHOICES.map((c) => {
                const selected = choice === c.value;
                return (
                  <label
                    key={c.value}
                    className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--nly-brand)]"
                    style={{
                      borderColor: selected ? "var(--nly-brand)" : "var(--nly-border)",
                      backgroundColor: selected ? "var(--nly-surface-hover)" : "transparent",
                      color: selected ? "var(--nly-text-primary)" : "var(--nly-text-tertiary)",
                    }}
                  >
                    <input
                      type="radio"
                      name="range"
                      value={c.value}
                      checked={selected}
                      onChange={() => setChoice(c.value)}
                      className="sr-only"
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {choice === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="report-from" style={{ color: "var(--nly-text-secondary)" }}>
                  From
                </Label>
                <Input
                  id="report-from"
                  type="date"
                  required
                  max={to || today}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="border"
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-to" style={{ color: "var(--nly-text-secondary)" }}>
                  To
                </Label>
                <Input
                  id="report-to"
                  type="date"
                  required
                  min={from || undefined}
                  max={today}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="border"
                  style={inputStyle}
                />
              </div>
              <p className="sm:col-span-2 text-[11px]" style={{ color: "var(--nly-text-tertiary)" }}>
                Up to {MAX_CUSTOM_DAYS} days. Both dates are included.
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            {loading ? "Building report…" : "Download PDF"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
