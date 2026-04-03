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

const labelStyle = { color: "var(--nly-text-primary)" };

export function Step1PropertyInfo({ data, onChange, onNext }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const autoCode = (name: string) =>
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-2">
          <Label style={labelStyle}>Property Name *</Label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none whitespace-nowrap"
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
              }}
              className="pl-[115px]"
              style={inputStyle}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Will display as &quot;Neighborlyy @ {data.name || "Your Property"}&quot;
          </p>
        </div>

        <div className="space-y-2">
          <Label style={labelStyle}>Community Code *</Label>
          <Input
            required
            placeholder="SUNSET"
            maxLength={8}
            value={data.community_code}
            onChange={(e) =>
              onChange({
                community_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              })
            }
            style={inputStyle}
          />
          <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
            Residents use this code to join. Max 8 characters.
          </p>
        </div>

        <div className="space-y-2">
          <Label style={labelStyle}>Property Type *</Label>
          <select
            required
            value={data.property_type}
            onChange={(e) =>
              onChange({ property_type: e.target.value as Step1Data["property_type"] })
            }
            className="flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label style={labelStyle}>State *</Label>
            <select
              required
              value={data.state}
              onChange={(e) => onChange({ state: e.target.value })}
              className="flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
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
      </div>

      <button
        type="submit"
        className="w-full h-11 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
      >
        Continue →
      </button>
    </form>
  );
}
