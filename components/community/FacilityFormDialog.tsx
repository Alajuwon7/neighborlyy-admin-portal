"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createFacility } from "@/app/(dashboard)/dashboard/communities/[id]/facilities/actions";
import { FACILITY_OPTIONS } from "@/lib/facilities";
import { toast } from "sonner";

export function FacilityFormDialog({
  communityCode,
  communityId,
}: {
  communityCode: string;
  communityId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");

  async function handleSubmit(formData: FormData) {
    const name = preset === "Other" ? customName.trim() : preset;
    if (!name) {
      toast.error("Please select a facility");
      return;
    }
    formData.set("name", name);

    setLoading(true);
    try {
      const result = await createFacility(formData, communityCode, communityId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Facility added");
        setPreset("");
        setCustomName("");
        setOpen(false);
      }
    } catch (err) {
      console.error("Failed to add facility:", err);
      toast.error("Something went wrong. Please try again.");
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
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
      >
        <Plus size={16} />
        Add Facility
      </DialogTrigger>
      <DialogContent
        className="border sm:max-w-md max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--nly-text-primary)" }}>
            Add Facility
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Facility
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FACILITY_OPTIONS.map((f) => {
                const isSelected = preset === f.label;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPreset(f.label)}
                    className="flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(47, 196, 211, 0.08)"
                        : "transparent",
                      borderColor: isSelected
                        ? "var(--nly-brand)"
                        : "var(--nly-border)",
                      color: isSelected
                        ? "var(--nly-text-primary)"
                        : "var(--nly-text-secondary)",
                    }}
                  >
                    <span className="text-base leading-none">{f.icon}</span>
                    <span className="text-xs font-medium">{f.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPreset("Other")}
                className="flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all"
                style={{
                  backgroundColor:
                    preset === "Other" ? "rgba(47, 196, 211, 0.08)" : "transparent",
                  borderColor:
                    preset === "Other" ? "var(--nly-brand)" : "var(--nly-border)",
                  color:
                    preset === "Other"
                      ? "var(--nly-text-primary)"
                      : "var(--nly-text-secondary)",
                }}
              >
                <span className="text-base leading-none">➕</span>
                <span className="text-xs font-medium">Other</span>
              </button>
            </div>
            {preset === "Other" && (
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter facility name"
                className="border mt-2"
                style={inputStyle}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Description
            </Label>
            <Textarea
              name="description"
              placeholder="Facility details..."
              className="border min-h-[60px]"
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Capacity
            </Label>
            <Input
              name="capacity"
              type="number"
              min="1"
              placeholder="20"
              className="border"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Opens
              </Label>
              <Input
                name="open_time"
                type="time"
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Closes
              </Label>
              <Input
                name="close_time"
                type="time"
                className="border"
                style={inputStyle}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            {loading ? "Adding..." : "Add Facility"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
