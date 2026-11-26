import { Label } from "@/components/ui/label";
import type { EventHost } from "@/lib/event-host";

/**
 * "Hosted by" select for the event create/edit forms (submits `hosted_by`).
 * With no known value it offers a blank choice, which the update action
 * ignores, so a failed host lookup can't overwrite a resident event.
 */
export function HostedByField({ defaultValue }: { defaultValue: EventHost | undefined }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="hosted_by" style={{ color: "var(--nly-text-secondary)" }}>
        Hosted by
      </Label>
      <select
        id="hosted_by"
        name="hosted_by"
        required={defaultValue !== undefined}
        defaultValue={defaultValue ?? ""}
        className="h-9 w-full rounded-md border px-3 text-sm"
        style={{
          backgroundColor: "var(--nly-input-bg)",
          borderColor: "var(--nly-input-border)",
          color: "var(--nly-text-primary)",
        }}
      >
        {defaultValue === undefined && <option value="">Keep as is</option>}
        <option value="management">Management</option>
        <option value="resident">Residents</option>
      </select>
      <p className="text-[11px]" style={{ color: "var(--nly-text-tertiary)" }}>
        Choose Residents when you&apos;re posting an event residents are running.
      </p>
    </div>
  );
}
