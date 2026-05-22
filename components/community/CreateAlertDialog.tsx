"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { AlertFormFields } from "@/components/community/AlertFormFields";
import { createAlert } from "@/app/(dashboard)/dashboard/communities/[id]/alerts/actions";
import { toast } from "sonner";

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
    try {
      const result = await createAlert(formData, communityCode, communityId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Alert sent — visible to residents in the app");
        setOpen(false);
      }
    } catch (err) {
      console.error("Failed to send alert:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
        className="border sm:max-w-md"
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
          <AlertFormFields mode="create" />
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
