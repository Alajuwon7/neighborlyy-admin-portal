"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
import { updateEvent, deleteEvent } from "@/app/(dashboard)/dashboard/communities/[id]/events/actions";
import { toast } from "sonner";

interface EventCardActionsProps {
  event: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    event_date: string;
    max_attendees: number | null;
  };
  communityId: string;
}

export function EventCardActions({ event, communityId }: EventCardActionsProps) {
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${event.title}"? This will remove it from the resident app.`)) return;
    setDeleting(true);
    const result = await deleteEvent(event.id, communityId);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Event deleted");
    }
  };

  const handleEdit = async (formData: FormData) => {
    setEditLoading(true);
    const result = await updateEvent(event.id, formData, communityId);
    setEditLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Event updated");
      setEditOpen(false);
    }
  };

  // Format event_date for datetime-local input
  const eventDateLocal = event.event_date
    ? new Date(event.event_date).toISOString().slice(0, 16)
    : "";

  const inputStyle = {
    backgroundColor: "var(--nly-input-bg)",
    borderColor: "var(--nly-input-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditOpen(true)}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[var(--nly-surface-hover)]"
          style={{ color: "var(--nly-text-tertiary)" }}
          title="Edit event"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[var(--nly-surface-hover)]"
          style={{ color: "var(--nly-text-tertiary)" }}
          title="Delete event"
        >
          <Trash2 size={13} />
        </button>
      </div>

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
              Edit Event
            </DialogTitle>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>Title</Label>
              <Input
                name="title"
                required
                defaultValue={event.title}
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>Description</Label>
              <Textarea
                name="description"
                defaultValue={event.description ?? ""}
                className="border min-h-[80px]"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>Location</Label>
              <Input
                name="location"
                defaultValue={event.location ?? ""}
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: "var(--nly-text-secondary)" }}>Date & Time</Label>
                <Input
                  name="event_date"
                  type="datetime-local"
                  required
                  defaultValue={eventDateLocal}
                  className="border"
                  style={inputStyle}
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: "var(--nly-text-secondary)" }}>Max Attendees</Label>
                <Input
                  name="max_attendees"
                  type="number"
                  min="1"
                  defaultValue={event.max_attendees ?? ""}
                  className="border"
                  style={inputStyle}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={editLoading}
              className="w-full text-white"
              style={{ backgroundColor: "var(--nly-brand)" }}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
