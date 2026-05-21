"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Image picker for the event create/edit forms. Renders a native file input
// named "image" (so it rides along in the form's FormData) plus a preview and
// remove control. On edit, pass the current image_url as existingUrl; clearing
// it sets a hidden remove_image=true that updateEvent honors.
export function EventImageField({ existingUrl }: { existingUrl?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const shownUrl = preview ?? (removed ? null : existingUrl ?? null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Image must be a JPG, PNG, or WebP file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 5MB or smaller.");
      e.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setRemoved(false);
  }

  function handleRemove() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    setRemoved(true);
  }

  return (
    <div className="space-y-2">
      <Label style={{ color: "var(--nly-text-secondary)" }}>
        Event image{" "}
        <span style={{ color: "var(--nly-text-tertiary)" }}>(optional)</span>
      </Label>

      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleSelect}
        className="hidden"
      />
      <input type="hidden" name="remove_image" value={removed ? "true" : "false"} />

      {shownUrl ? (
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shownUrl}
            alt="Event"
            className="w-full max-h-40 object-cover rounded-xl border"
            style={{ borderColor: "var(--nly-border)" }}
          />
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove image"
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 h-20 rounded-xl border border-dashed text-sm transition-opacity hover:opacity-80"
          style={{ borderColor: "var(--nly-border)", color: "var(--nly-text-tertiary)" }}
        >
          <ImagePlus size={16} />
          Add an image
        </button>
      )}
    </div>
  );
}
