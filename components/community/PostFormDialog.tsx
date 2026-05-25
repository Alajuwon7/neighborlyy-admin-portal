"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";
import { createPost } from "@/app/(dashboard)/dashboard/feed/actions";
import { toast } from "sonner";

export function PostFormDialog({ communityCode }: { communityCode: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      const result = await createPost(formData, communityCode);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Post published — visible to residents in the app");
        setOpen(false);
      }
    } catch (err) {
      console.error("Failed to publish post:", err);
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
        <Megaphone size={16} />
        New Post
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
            Post to Community Feed
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
          This will be visible to all residents in the mobile app.
        </p>
        <form action={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Message
            </Label>
            <Textarea
              name="content"
              required
              placeholder="Welcome to our community! We're excited to have you here..."
              className="border min-h-[140px]"
              style={inputStyle}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            {loading ? "Publishing..." : "Publish Post"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
