"use client";

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
import { PRIORITIES, ALERT_DURATIONS } from "@/lib/alerts";

const inputStyle = {
  backgroundColor: "var(--nly-input-bg)",
  borderColor: "var(--nly-input-border)",
  color: "var(--nly-text-primary)",
};

/**
 * Shared title/message/priority/duration fields for the create and edit alert
 * dialogs. Submits via `name` attributes into the surrounding <form>.
 * - create: duration select defaults to "off" (standing alert).
 * - edit: duration select adds a leading "Keep current" option (default) so an
 *   edit can leave the existing pin/expiry untouched.
 */
export function AlertFormFields({
  mode,
  defaultValues,
}: {
  mode: "create" | "edit";
  defaultValues?: { title?: string; message?: string; priority?: string };
}) {
  const priorityItems = Object.fromEntries(
    PRIORITIES.map((p) => [p.value, p.label])
  );

  const durationItems: Record<string, string> = {
    ...(mode === "edit" ? { keep: "Keep current" } : {}),
    off: mode === "edit" ? "Remove pin & expiry" : "No expiry (standing)",
    ...Object.fromEntries(ALERT_DURATIONS.map((d) => [d.value, d.label])),
  };
  const durationDefault = mode === "edit" ? "keep" : "off";

  return (
    <>
      <div className="space-y-2">
        <Label style={{ color: "var(--nly-text-secondary)" }}>Title</Label>
        <Input
          name="title"
          required
          defaultValue={defaultValues?.title}
          placeholder="Alert title"
          className="border"
          style={inputStyle}
        />
      </div>

      <div className="space-y-2">
        <Label style={{ color: "var(--nly-text-secondary)" }}>Message</Label>
        <Textarea
          name="message"
          required
          defaultValue={defaultValues?.message}
          placeholder="Alert message..."
          className="border min-h-[100px]"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label style={{ color: "var(--nly-text-secondary)" }}>Priority</Label>
          <Select
            name="priority"
            required
            defaultValue={defaultValues?.priority}
            items={priorityItems}
          >
            <SelectTrigger variant="form">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent variant="form">
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value} variant="form">
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
            Show pinned for
          </Label>
          <Select name="pin_duration" defaultValue={durationDefault} items={durationItems}>
            <SelectTrigger variant="form">
              <SelectValue placeholder="No expiry" />
            </SelectTrigger>
            <SelectContent variant="form">
              {Object.entries(durationItems).map(([value, label]) => (
                <SelectItem key={value} value={value} variant="form">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Pinned alerts show a countdown, then disappear for residents.
          </p>
        </div>
      </div>
    </>
  );
}
