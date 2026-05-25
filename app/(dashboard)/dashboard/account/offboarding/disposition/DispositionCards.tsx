"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { setCommunityDisposition, finalizeDispositions } from "./actions";
import { CAN_USE_TRANSFER } from "@/lib/offboarding/feature-flags";
import {
  canCloseCommunity,
  type CommunitySummary,
} from "@/lib/offboarding/disposition";
import type { CommunityDisposition } from "@/lib/offboarding/types";

interface DispositionCardsProps {
  deletionRequestId: string;
  communities: CommunitySummary[];
  initialDispositions: CommunityDisposition[];
}

type LocalAction = "transfer" | "suspend" | "close";

export function DispositionCards({
  communities,
  initialDispositions,
}: DispositionCardsProps) {
  const router = useRouter();
  const [dispositions, setDispositions] = useState<CommunityDisposition[]>(initialDispositions);
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function getDisposition(communityId: string) {
    return dispositions.find((d) => d.community_id === communityId) ?? null;
  }

  async function handleConfirm(community: CommunitySummary, action: LocalAction) {
    setWorking(community.community_id);
    const result = await setCommunityDisposition(community.community_id, action);
    setWorking(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${community.name}: set to ${action}`);
    setDispositions((prev) => [
      ...prev.filter((d) => d.community_id !== community.community_id),
      {
        community_id: community.community_id,
        action: action as "transfer" | "suspend" | "close",
        set_at: new Date().toISOString(),
      },
    ]);
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeDispositions();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push("/dashboard/account/offboarding/finalize");
    });
  }

  const allDecided = communities.length > 0 && communities.every((c) => getDisposition(c.community_id));

  return (
    <div className="space-y-4">
      {communities.map((c) => (
        <DispositionCard
          key={c.community_id}
          community={c}
          current={getDisposition(c.community_id)}
          working={working === c.community_id}
          onConfirm={(action) => handleConfirm(c, action)}
        />
      ))}

      <button
        type="button"
        disabled={!allDecided || pending}
        onClick={handleFinalize}
        className="w-full h-10 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
      >
        {pending ? "Finalizing..." : "Continue to account closure →"}
      </button>
    </div>
  );
}

function DispositionCard({
  community,
  current,
  working,
  onConfirm,
}: {
  community: CommunitySummary;
  current: CommunityDisposition | null;
  working: boolean;
  onConfirm: (action: LocalAction) => void;
}) {
  const [selected, setSelected] = useState<LocalAction | null>(
    (current?.action as LocalAction | undefined) ?? null,
  );

  const closable = canCloseCommunity(community.active_residents);

  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ backgroundColor: "var(--nly-surface)", borderColor: "var(--nly-border)" }}
    >
      <header>
        <h3 className="text-base font-semibold" style={{ color: "var(--nly-text-primary)" }}>
          {community.name}
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--nly-text-secondary)" }}>
          {community.active_residents} active residents · {community.pending_residents} pending ·{" "}
          {community.upcoming_events} upcoming events · {community.open_help_requests} open help requests
        </p>
      </header>

      <fieldset className="space-y-2 text-sm">
        <legend className="text-xs font-semibold mb-1" style={{ color: "var(--nly-text-secondary)" }}>
          What should happen to this community?
        </legend>

        <RadioOption
          checked={selected === "transfer"}
          onChange={() => setSelected("transfer")}
          disabled={!CAN_USE_TRANSFER}
          label="Transfer to another PM"
          description={CAN_USE_TRANSFER ? "They will receive an invitation to accept." : "Coming in v1.1"}
        />

        <RadioOption
          checked={selected === "suspend"}
          onChange={() => setSelected("suspend")}
          label="Suspend"
          description="Residents will be notified. The community will be locked until a new PM takes over."
        />

        <RadioOption
          checked={selected === "close"}
          onChange={() => setSelected("close")}
          disabled={!closable}
          label="Close and archive"
          description={
            closable
              ? "The community will be archived permanently."
              : `(Currently unavailable — ${community.active_residents} active residents)`
          }
        />
      </fieldset>

      <div className="flex items-center justify-between gap-3 pt-1">
        {current ? (
          <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--nly-success)" }}>
            <Check size={14} /> Confirmed: {current.action}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Not yet confirmed
          </span>
        )}
        <button
          type="button"
          disabled={
            !selected ||
            working ||
            (selected === "transfer" && !CAN_USE_TRANSFER) ||
            current?.action === selected
          }
          onClick={() => selected && onConfirm(selected)}
          className="h-9 rounded-lg text-sm font-medium border px-3 transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-2"
          style={{ borderColor: "var(--nly-brand)", color: "var(--nly-brand)" }}
        >
          {working ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving...
            </>
          ) : current && current.action === selected ? (
            "Already confirmed"
          ) : current ? (
            "Update disposition"
          ) : (
            "Confirm this community's disposition"
          )}
        </button>
      </div>
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
  description: string;
}) {
  return (
    <label
      className="flex items-start gap-2 cursor-pointer"
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="radio"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="space-y-0.5">
        <span className="block font-medium" style={{ color: "var(--nly-text-primary)" }}>
          {label}
        </span>
        <span className="block text-xs" style={{ color: "var(--nly-text-secondary)" }}>
          {description}
        </span>
      </span>
    </label>
  );
}
