import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment Complex" },
  { value: "condo", label: "Condominium" },
  { value: "student", label: "Student Housing" },
  { value: "senior", label: "Senior Living" },
] as const;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export interface Step1Data {
  name: string;
  community_code: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  unit_count: string;
  property_type: "apartment" | "condo" | "student" | "senior";
  website_url: string;
}

interface Props {
  data: Step1Data;
  onChange: (data: Partial<Step1Data>) => void;
  onNext: () => void;
}

const inputStyle = {
  backgroundColor: "var(--nly-input-bg)",
  borderColor: "var(--nly-input-border)",
  color: "var(--nly-text-primary)",
};

const errorInputStyle = {
  ...inputStyle,
  borderColor: "var(--nly-error, #ef4444)",
};

const labelStyle = { color: "var(--nly-text-primary)" };

const selectStyle = "flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm";

export function Step1PropertyInfo({ data, onChange, onNext }: Props) {
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; community_code?: string }>({});

  const autoCode = (name: string) =>
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setValidating(true);

    try {
      const supabase = createClient();
      const newErrors: typeof errors = {};

      const { data: existingName } = await supabase
        .from("communities")
        .select("id")
        .eq("building_name", data.name)
        .limit(1);

      if (existingName && existingName.length > 0) {
        newErrors.name = "A community with this property name already exists.";
      }

      const { data: existingCode } = await supabase
        .from("communities")
        .select("id")
        .eq("community_code", data.community_code)
        .limit(1);

      if (existingCode && existingCode.length > 0) {
        newErrors.community_code = "This community code is already taken. Try a different one.";
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        const messages = Object.values(newErrors);
        toast.error(messages.join(" "));
        return;
      }

      onNext();
    } catch {
      toast.error("Could not validate. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Property Name — stacked label on mobile, inline prefix on desktop */}
        <div className="sm:col-span-2 space-y-2">
          <Label style={labelStyle}>Property Name *</Label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
            <span
              className="text-sm font-medium sm:absolute sm:left-3 sm:top-1/2 sm:-translate-y-1/2 sm:pointer-events-none whitespace-nowrap"
              style={{ color: "var(--nly-brand)" }}
            >
              Neighborlyy @
            </span>
            <div className="relative w-full">
              <span
                className="hidden sm:block absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none whitespace-nowrap"
                style={{ color: "var(--nly-brand)" }}
              >
                Neighborlyy @
              </span>
              <Input
                required
                placeholder="The Reserve"
                value={data.name}
                onChange={(e) => {
                  onChange({
                    name: e.target.value,
                    community_code: autoCode(e.target.value),
                  });
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                className="sm:pl-[115px]"
                style={errors.name ? errorInputStyle : inputStyle}
              />
            </div>
          </div>
          {errors.name ? (
            <p className="text-xs font-medium" style={{ color: "var(--nly-error, #ef4444)" }}>
              {errors.name}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              Will display as &quot;Neighborlyy @ {data.name || "Your Property"}&quot;
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label style={labelStyle}>Community Code *</Label>
          <Input
            required
            placeholder="SUNSET"
            maxLength={8}
            value={data.community_code}
            onChange={(e) => {
              onChange({
                community_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              });
              if (errors.community_code) setErrors((prev) => ({ ...prev, community_code: undefined }));
            }}
            style={errors.community_code ? errorInputStyle : inputStyle}
          />
          {errors.community_code ? (
            <p className="text-xs font-medium" style={{ color: "var(--nly-error, #ef4444)" }}>
              {errors.community_code}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
              Residents use this code to join. Max 8 characters.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label style={labelStyle}>Property Type *</Label>
          <select
            required
            value={data.property_type}
            onChange={(e) =>
              onChange({ property_type: e.target.value as Step1Data["property_type"] })
            }
            className={selectStyle}
            style={inputStyle}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label style={labelStyle}>Street Address *</Label>
          <Input
            required
            placeholder="123 Main Street"
            value={data.street_address}
            onChange={(e) => onChange({ street_address: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <Label style={labelStyle}>City *</Label>
          <Input
            required
            placeholder="Austin"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label style={labelStyle}>State *</Label>
            <select
              required
              value={data.state}
              onChange={(e) => onChange({ state: e.target.value })}
              className={selectStyle}
              style={inputStyle}
            >
              <option value="">—</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label style={labelStyle}>ZIP *</Label>
            <Input
              required
              placeholder="78701"
              maxLength={5}
              value={data.zip_code}
              onChange={(e) =>
                onChange({ zip_code: e.target.value.replace(/\D/g, "") })
              }
              style={inputStyle}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label style={labelStyle}>Number of Units *</Label>
          <Input
            required
            type="number"
            min="1"
            max="10000"
            placeholder="200"
            value={data.unit_count}
            onChange={(e) => onChange({ unit_count: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <Label style={{ color: "var(--nly-text-secondary)" }}>Property Website</Label>
          <Input
            type="url"
            placeholder="https://yourproperty.com"
            value={data.website_url}
            onChange={(e) => onChange({ website_url: e.target.value })}
            style={inputStyle}
          />
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Optional — helps us learn more about your community
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={validating}
        className="w-full h-11 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
      >
        {validating ? "Checking availability…" : "Continue →"}
      </button>
    </form>
  );
}
