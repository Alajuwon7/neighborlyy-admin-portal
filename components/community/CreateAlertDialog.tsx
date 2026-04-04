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
import { Bell } from "lucide-react";
import { createAlert } from "@/app/(dashboard)/dashboard/communities/[id]/alerts/actions";
import { toast } from "sonner";

const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "var(--nly-alert-urgent)" },
  { value: "high", label: "High", color: "var(--nly-alert-high)" },
  { value: "medium", label: "Medium", color: "var(--nly-alert-medium)" },
  { value: "low", label: "Low", color: "var(--nly-alert-low)" },
];

export function CreateAlertDialog({
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
    const result = await createAlert(formData, communityCode, communityId);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Alert sent — visible to residents in the app");
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
        <Bell size={16} />
        Send Alert
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
            Send Community Alert
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          Residents will see this alert in the mobile app immediately.
        </p>
        <form action={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>Title</Label>
            <Input
              name="title"
              required
              placeholder="Alert title"
              className="border"
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Message
            </Label>
            <Textarea
              name="message"
              required
              placeholder="Alert message..."
              className="border min-h-[100px]"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Priority
              </Label>
              <Select name="priority" required>
                <SelectTrigger className="border" style={inputStyle}>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: "var(--nly-surface)",
                    borderColor: "var(--nly-border)",
                  }}
                >
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Expires
              </Label>
              <Input
                name="valid_until"
                type="datetime-local"
                className="border"
                style={inputStyle}
              />
              <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                Leave blank for no expiry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_pinned"
              value="true"
              id="is_pinned"
              className="w-4 h-4 rounded border accent-[var(--nly-brand)]"
              style={{ borderColor: "var(--nly-border)" }}
            />
            <Label
              htmlFor="is_pinned"
              className="cursor-pointer"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              Pin this alert (stays at top)
            </Label>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white"
            style={{ backgroundColor: "var(--nly-brand)" }}
          >
            {loading ? "Sending..." : "Send Alert"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
