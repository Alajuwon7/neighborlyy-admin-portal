"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Smartphone } from "lucide-react";
import Link from "next/link";
import { use } from "react";

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "student", label: "Student Housing" },
  { value: "senior", label: "Senior Living" },
] as const;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
] as const;

interface CommunityData {
  id: string;
  name: string;
  community_code: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  unit_count: number | null;
  property_type: string | null;
  primary_color: string | null;
}

export default function CompleteSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [community, setCommunity] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [unitCount, setUnitCount] = useState("");
  const [propertyType, setPropertyType] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("communities")
        .select("id, name, community_code, street_address, city, state, zip_code, unit_count, property_type, primary_color")
        .eq("id", id)
        .single();

      if (fetchError || !data) {
        setError("Community not found.");
        setLoading(false);
        return;
      }

      const c = data as CommunityData;
      setCommunity(c);
      setStreetAddress(c.street_address ?? "");
      setCity(c.city ?? "");
      setState(c.state ?? "");
      setZipCode(c.zip_code ?? "");
      setUnitCount(c.unit_count != null ? String(c.unit_count) : "");
      setPropertyType(c.property_type ?? "");
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!community) return;

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("communities")
      .update({
        street_address: streetAddress,
        city,
        state,
        zip_code: zipCode,
        unit_count: parseInt(unitCount, 10),
        property_type: propertyType,
      })
      .eq("id", community.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/communities/${community.id}`);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm" style={{ color: "var(--nly-error)" }}>
          {error ?? "Community not found."}
        </p>
      </div>
    );
  }

  const inputStyle = {
    backgroundColor: "var(--nly-bg)",
    borderColor: "var(--nly-border)",
    color: "var(--nly-text-primary)",
  };

  return (
    <main className="flex-1 p-4 sm:p-6 max-w-5xl">
      <div className="max-w-xl mx-auto space-y-6">
        <Link
          href="/dashboard/communities"
          className="inline-flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: "var(--nly-accent)" }}
        >
          <ArrowLeft size={14} />
          Back to Communities
        </Link>

        <div
          className="rounded-2xl border p-6 space-y-6"
          style={{
            backgroundColor: "var(--nly-surface)",
            borderColor: "var(--nly-border)",
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
                style={{ backgroundColor: community.primary_color ?? "var(--nly-brand)" }}
              >
                {community.name.charAt(0)}
              </div>
              <div>
                <h1
                  className="text-lg font-semibold"
                  style={{ color: "var(--nly-text-primary)" }}
                >
                  Complete Setup
                </h1>
                <p className="text-sm" style={{ color: "var(--nly-text-tertiary)" }}>
                  {community.name}
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mt-3"
              style={{ backgroundColor: "rgba(139, 92, 246, 0.08)" }}
            >
              <Smartphone size={14} style={{ color: "rgb(139, 92, 246)" }} />
              <p className="text-xs" style={{ color: "rgb(139, 92, 246)" }}>
                This community was migrated from the mobile app. Fill in the
                missing details below to enable full admin portal features.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--nly-text-secondary)" }}
              >
                Street Address *
              </label>
              <input
                type="text"
                required
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                style={inputStyle}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Atlanta"
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  State *
                </label>
                <select
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={inputStyle}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  ZIP Code *
                </label>
                <input
                  type="text"
                  required
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="30303"
                  pattern="[0-9]{5}"
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--nly-text-secondary)" }}
                >
                  Unit Count *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={unitCount}
                  onChange={(e) => setUnitCount(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--nly-text-secondary)" }}
              >
                Property Type *
              </label>
              <select
                required
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                style={inputStyle}
              >
                <option value="">Select type</option>
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs" style={{ color: "var(--nly-error)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--nly-brand)" }}
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
