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
import { EventImageField } from "@/components/community/EventImageField";
import { localInputsToIso } from "@/lib/event-time";
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
    try {
      const date = formData.get("event_date") as string;
      const timeStart = formData.get("event_time_start") as string;
      const timeEnd = formData.get("event_time_end") as string;

      const startIso = localInputsToIso(date, timeStart);
      if (!startIso) {
        toast.error("Please enter a valid date and start time.");
        return;
      }
      formData.set("event_date", startIso);

      if (timeEnd) {
        const endLocal = new Date(`${date}T${timeEnd}`);
        const startMs = new Date(startIso).getTime();
        if (endLocal.getTime() === startMs) {
          toast.error("End time must be different from the start time.");
          return;
        }
        // An end time earlier than the start means the event runs past midnight.
        if (endLocal.getTime() < startMs) endLocal.setDate(endLocal.getDate() + 1);
        const endFormatted = endLocal.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const existing = ((formData.get("description") as string) || "").trim();
        formData.set("description", `${existing}\n\nEnds at: ${endFormatted}`);
      }

      const result = await createEvent(formData, communityCode, communityId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Event created — visible to residents in the app");
        setOpen(false);
      }
    } catch (err) {
      console.error("Failed to create event:", err);
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
        Create Event
      </DialogTrigger>
      <DialogContent
        className="border sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0"
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
              className="border min-h-[120px] max-h-[40vh] break-words [overflow-wrap:anywhere]"
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
          <EventImageField />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>Date</Label>
              <Input
                name="event_date"
                type="date"
                required
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Start Time
              </Label>
              <Input
                name="event_time_start"
                type="time"
                required
                className="border"
                style={inputStyle}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                End Time{" "}
                <span style={{ color: "var(--nly-text-tertiary)" }}>
                  (optional)
                </span>
              </Label>
              <Input
                name="event_time_end"
                type="time"
                className="border"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Max Attendees{" "}
              <span style={{ color: "var(--nly-text-tertiary)" }}>
                (optional)
              </span>
            </Label>
            <Input
              name="max_attendees"
              type="number"
              min="1"
                max="100000"
              step="1"
              placeholder="No limit"
              className="border sm:max-w-[200px]"
              style={inputStyle}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            {loading ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
