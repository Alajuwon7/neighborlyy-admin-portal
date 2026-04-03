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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createFacility } from "@/app/(dashboard)/dashboard/communities/[id]/facilities/actions";
import { toast } from "sonner";

const FACILITY_TYPES = [
  "Pool",
  "Gym",
  "Clubhouse",
  "Tennis Court",
  "Basketball Court",
  "Playground",
  "BBQ Area",
  "Business Center",
  "Parking",
  "Laundry",
  "Dog Park",
  "Other",
];

export function FacilityFormDialog({
  communityCode,
  communityId,
}: {
  communityCode: string;
  communityId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await createFacility(formData, communityCode, communityId);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Facility added");
      setOpen(false);
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
        style={{ backgroundColor: "var(--nly-brand)" }}
      >
        <Plus size={16} />
        Add Facility
      </DialogTrigger>
      <DialogContent
        className="border"
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
            <Label style={{ color: "var(--nly-text-secondary)" }}>Name</Label>
            <Input
              name="name"
              required
              placeholder="Main Pool"
              className="border"
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>Type</Label>
            <Select name="type" required>
              <SelectTrigger className="border" style={inputStyle}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: "var(--nly-surface)",
                  borderColor: "var(--nly-border)",
                }}
              >
                {FACILITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t.toLowerCase().replace(/ /g, "_")}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label style={{ color: "var(--nly-text-secondary)" }}>Hours</Label>
            <Input
              name="hours"
              placeholder="6:00 AM - 10:00 PM"
              className="border"
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>Rules</Label>
            <Textarea
              name="rules"
              placeholder="No glass, towels required..."
              className="border min-h-[60px]"
              style={inputStyle}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white"
            style={{ backgroundColor: "var(--nly-brand)" }}
          >
            {loading ? "Adding..." : "Add Facility"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
