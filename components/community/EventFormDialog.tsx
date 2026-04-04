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
import { createEvent } from "@/app/(dashboard)/dashboard/communities/[id]/events/actions";
import { toast } from "sonner";

export function EventFormDialog({
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
    const result = await createEvent(formData, communityCode, communityId);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Event created — visible to residents in the app");
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
        Create Event
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
            Create Event
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          This event will appear in the resident mobile app.
        </p>
        <form action={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>Title</Label>
            <Input
              name="title"
              required
              placeholder="Community BBQ"
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
              placeholder="Event details..."
              className="border min-h-[80px]"
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Location
            </Label>
            <Input
              name="location"
              placeholder="Community Center"
              className="border"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Date & Time
              </Label>
              <Input
                name="event_date"
                type="datetime-local"
                required
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Max Attendees
              </Label>
              <Input
                name="max_attendees"
                type="number"
                min="1"
                placeholder="Optional"
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
            {loading ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
