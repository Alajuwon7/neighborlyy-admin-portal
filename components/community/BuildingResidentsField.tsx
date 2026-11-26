"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateBuildingResidentCount } from "@/app/(dashboard)/dashboard/communities/[id]/actions";

/** Property Details row: residents living in the building, editable inline. */
export function BuildingResidentsField({
  communityId,
  value,
}: {
  communityId: string;
  value: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("count") ?? "");
    setSaving(true);
    try {
      const result = await updateBuildingResidentCount(communityId, raw);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Saved");
        setEditing(false);
      }
    } catch (err) {
      console.error("Failed to save building resident count:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs shrink-0" style={{ color: "var(--nly-text-tertiary)" }}>
        Residents in building
      </span>
      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <label htmlFor="building-resident-count" className="sr-only">
            Residents living in the building
          </label>
          <input
            id="building-resident-count"
            name="count"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            step={1}
            defaultValue={value ?? ""}
            autoFocus
            className="w-24 rounded-md border px-2 py-1 text-xs text-right"
            style={{
              backgroundColor: "var(--nly-input-bg)",
              borderColor: "var(--nly-input-border)",
              color: "var(--nly-text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--nly-brand)", color: "var(--nly-brand-text)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-2 py-1 text-xs"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-right hover:underline"
          style={{ color: value ? "var(--nly-text-secondary)" : "var(--nly-accent)" }}
          aria-label={value ? `Edit residents in building (${value})` : "Add residents in building"}
        >
          {value ? `${value.toLocaleString()} residents` : "Add count"}
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}
