"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Power } from "lucide-react";
import {
  updateFacility,
  deleteFacility,
  toggleFacilityAvailability,
} from "@/app/(dashboard)/dashboard/communities/[id]/facilities/actions";
import { toast } from "sonner";

type Facility = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  open_time: string | null;
  close_time: string | null;
  available: boolean;
};

export function FacilityRowActions({
  facility,
  communityId,
}: {
  facility: Facility;
  communityId: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  async function handleEdit(formData: FormData) {
    setLoading(true);
    const result = await updateFacility(facility.id, formData, communityId);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Facility updated");
      setEditOpen(false);
    }
  }

  async function handleToggle() {
    const result = await toggleFacilityAvailability(
      facility.id,
      !facility.available,
      communityId
    );
    if (result.error) toast.error(result.error);
    else
      toast.success(
        facility.available ? "Marked unavailable" : "Marked available"
      );
  }

  async function handleDelete() {
    if (!confirm(`Delete "${facility.name}"? This cannot be undone.`)) return;
    const result = await deleteFacility(facility.id, communityId);
    if (result.error) toast.error(result.error);
    else toast.success("Facility deleted");
  }

  const iconBtn =
    "p-1.5 rounded-md transition-colors hover:bg-[var(--nly-hover)]";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleToggle}
        className={iconBtn}
        title={facility.available ? "Mark unavailable" : "Mark available"}
      >
        <Power
          size={14}
          style={{
            color: facility.available
              ? "var(--nly-success)"
              : "var(--nly-text-tertiary)",
          }}
        />
      </button>
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className={iconBtn}
        title="Edit"
      >
        <Pencil size={14} style={{ color: "var(--nly-text-secondary)" }} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className={iconBtn}
        title="Delete"
      >
        <Trash2 size={14} style={{ color: "var(--nly-error)" }} />
      </button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="border"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--nly-text-primary)" }}>
              Edit Facility
            </DialogTitle>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>Name</Label>
              <Input
                name="name"
                defaultValue={facility.name}
                required
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Description
              </Label>
              <Textarea
                name="description"
                defaultValue={facility.description ?? ""}
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
                defaultValue={facility.capacity ?? ""}
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
                  defaultValue={facility.open_time?.slice(0, 5) ?? ""}
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
                  defaultValue={facility.close_time?.slice(0, 5) ?? ""}
                  className="border"
                  style={inputStyle}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full text-white"
              style={{ backgroundColor: "var(--nly-brand)" }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
