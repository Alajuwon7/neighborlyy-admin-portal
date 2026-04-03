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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { inviteTeamMember } from "@/app/(dashboard)/dashboard/team/actions";
import { toast } from "sonner";

interface Community {
  id: string;
  name: string;
}

export function InviteTeamMemberDialog({
  communities,
}: {
  communities: Community[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await inviteTeamMember(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Team member invited");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--nly-brand)" }}
      >
        <UserPlus size={16} />
        Invite Member
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
            Invite Team Member
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label
              htmlFor="full_name"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              Full Name
            </Label>
            <Input
              id="full_name"
              name="full_name"
              required
              placeholder="John Smith"
              className="border"
              style={{
                backgroundColor: "var(--nly-input-bg)",
                borderColor: "var(--nly-input-border)",
                color: "var(--nly-text-primary)",
              }}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="john@example.com"
              className="border"
              style={{
                backgroundColor: "var(--nly-input-bg)",
                borderColor: "var(--nly-input-border)",
                color: "var(--nly-text-primary)",
              }}
            />
          </div>

          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>Role</Label>
            <Select name="role" required>
              <SelectTrigger
                className="border"
                style={{
                  backgroundColor: "var(--nly-input-bg)",
                  borderColor: "var(--nly-input-border)",
                  color: "var(--nly-text-primary)",
                }}
              >
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: "var(--nly-surface)",
                  borderColor: "var(--nly-border)",
                }}
              >
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="assistant_manager">
                  Assistant Manager
                </SelectItem>
                <SelectItem value="leasing_agent">Leasing Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label style={{ color: "var(--nly-text-secondary)" }}>
              Community
            </Label>
            <Select name="community_id" required>
              <SelectTrigger
                className="border"
                style={{
                  backgroundColor: "var(--nly-input-bg)",
                  borderColor: "var(--nly-input-border)",
                  color: "var(--nly-text-primary)",
                }}
              >
                <SelectValue placeholder="Select community" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: "var(--nly-surface)",
                  borderColor: "var(--nly-border)",
                }}
              >
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full text-white"
            style={{ backgroundColor: "var(--nly-brand)" }}
          >
            {loading ? "Sending invite..." : "Send Invite"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
