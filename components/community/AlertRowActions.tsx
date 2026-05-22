"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertFormFields } from "@/components/community/AlertFormFields";
import {
  updateAlert,
  deleteAlert,
} from "@/app/(dashboard)/dashboard/communities/[id]/alerts/actions";
import { toast } from "sonner";

interface AlertRowActionsProps {
  alert: {
    id: string;
    title: string;
    message: string;
    priority: string;
  };
  communityId: string;
}

export function AlertRowActions({ alert, communityId }: AlertRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleEdit(formData: FormData) {
    setEditLoading(true);
    try {
      const result = await updateAlert(alert.id, formData, communityId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Alert updated");
        setEditOpen(false);
      }
    } catch (err) {
      console.error("Failed to update alert:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${alert.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const result = await deleteAlert(alert.id, communityId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Alert deleted");
      }
    } catch (err) {
      console.error("Failed to delete alert:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setEditOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-tertiary)",
          }}
          title="Edit alert"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-8 h-8 flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-tertiary)",
          }}
          title="Delete alert"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="border sm:max-w-md"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--nly-text-primary)" }}>
              Edit Alert
            </DialogTitle>
          </DialogHeader>
          <form action={handleEdit} className="space-y-4 mt-2">
            <AlertFormFields
              mode="edit"
              defaultValues={{
                title: alert.title,
                message: alert.message,
                priority: alert.priority,
              }}
            />
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
