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
import { UserPlus, UserRound, Briefcase } from "lucide-react";
import { inviteTeamMember } from "@/app/(dashboard)/dashboard/team/actions";
import { toast } from "sonner";

interface Community {
  id: string;
  name: string;
}

const ROLE_ITEMS = {
  manager: "Manager",
  assistant_manager: "Assistant Manager",
  leasing_agent: "Leasing Agent",
};

export function InviteTeamMemberDialog({
  communities,
}: {
  communities: Community[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      const result = await inviteTeamMember(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Team member invited");
        setFullName("");
        setOpen(false);
      }
    } catch (err) {
      console.error("Failed to invite team member:", err);
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

  const initial = fullName.trim().charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
      >
        <UserPlus size={16} />
        Invite Member
      </DialogTrigger>
      <DialogContent
        className="border sm:max-w-md max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--nly-text-primary)" }}>
            Invite team member
          </DialogTitle>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            We&apos;ll email them an invite to create their account.
          </p>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-5 mt-2">
          {/* Avatar / live preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold shrink-0"
              style={{
                backgroundColor: "rgba(47, 196, 211, 0.12)",
                color: "var(--nly-brand)",
              }}
            >
              {initial || <UserPlus size={24} />}
            </div>
            <div className="min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: "var(--nly-text-primary)" }}
              >
                {fullName.trim() || "New team member"}
              </p>
              <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                They&apos;ll receive an email invite
              </p>
            </div>
          </div>

          {/* Personal information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserRound size={15} style={{ color: "var(--nly-brand)" }} />
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--nly-text-primary)" }}
              >
                Personal information
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="full_name"
                style={{ color: "var(--nly-text-secondary)" }}
              >
                Full name
              </Label>
              <Input
                id="full_name"
                name="full_name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Smith"
                className="border"
                style={inputStyle}
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
                style={inputStyle}
              />
            </div>
          </div>

          {/* Professional information */}
          <div
            className="space-y-3 pt-4 border-t"
            style={{ borderColor: "var(--nly-divider)" }}
          >
            <div className="flex items-center gap-2">
              <Briefcase size={15} style={{ color: "var(--nly-brand)" }} />
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--nly-text-primary)" }}
              >
                Professional information
              </p>
            </div>

            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>Role</Label>
              <Select name="role" required items={ROLE_ITEMS}>
                <SelectTrigger variant="form">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent variant="form">
                  {Object.entries(ROLE_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value} variant="form">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: "var(--nly-text-secondary)" }}>
                Community
              </Label>
              {communities.length === 0 ? (
                <p
                  className="text-xs"
                  style={{ color: "var(--nly-text-tertiary)" }}
                >
                  You don&apos;t have any communities yet. Create one before
                  inviting members.
                </p>
              ) : (
                <Select
                  name="community_id"
                  required
                  items={Object.fromEntries(
                    communities.map((c) => [c.id, c.name])
                  )}
                >
                  <SelectTrigger variant="form">
                    <SelectValue placeholder="Select community" />
                  </SelectTrigger>
                  <SelectContent variant="form">
                    {communities.map((c) => (
                      <SelectItem key={c.id} value={c.id} variant="form">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex gap-3 pt-4 border-t"
            style={{ borderColor: "var(--nly-divider)" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 h-10 rounded-xl font-medium text-sm border transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--nly-border)",
                color: "var(--nly-text-secondary)",
                backgroundColor: "transparent",
              }}
            >
              Cancel
            </button>
            <Button
              type="submit"
              size="lg"
              disabled={loading || communities.length === 0}
              className="flex-1 text-white"
              style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
            >
              {loading ? "Sending invite..." : "Send invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
