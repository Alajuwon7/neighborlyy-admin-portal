export interface FacilityOption {
  id: string;
  label: string;
  icon: string;
}

// Shared between onboarding (Step3Facilities) and the dashboard Add Facility
// picker so the two stay in parity.
export const FACILITY_OPTIONS: FacilityOption[] = [
  { id: "pool", label: "Swimming Pool", icon: "🏊" },
  { id: "gym", label: "Fitness Center", icon: "🏋️" },
  { id: "clubhouse", label: "Clubhouse", icon: "🏠" },
  { id: "dog_park", label: "Dog Park", icon: "🐕" },
  { id: "playground", label: "Playground", icon: "🛝" },
  { id: "tennis", label: "Tennis Court", icon: "🎾" },
  { id: "basketball", label: "Basketball Court", icon: "🏀" },
  { id: "bbq", label: "BBQ / Grill Area", icon: "🔥" },
  { id: "coworking", label: "Co-working Space", icon: "💻" },
  { id: "theater", label: "Theater Room", icon: "🎬" },
  { id: "rooftop", label: "Rooftop Deck", icon: "🌆" },
  { id: "parking", label: "Covered Parking", icon: "🅿️" },
  { id: "ev_charging", label: "EV Charging", icon: "⚡" },
  { id: "laundry", label: "Laundry Room", icon: "👕" },
  { id: "package_room", label: "Package Room", icon: "📦" },
  { id: "bike_storage", label: "Bike Storage", icon: "🚲" },
  { id: "conference", label: "Conference Room", icon: "🤝" },
  { id: "spa", label: "Spa / Sauna", icon: "🧖" },
];

export const DEFAULT_FACILITY_ICON = "🏢";

// Keyword → emoji, used to resolve an icon from a stored facility name. Covers
// both the current labels and older/custom names (e.g. "Pool", "Gym").
const ICON_KEYWORDS: ReadonlyArray<readonly [string, string]> = [
  ["pool", "🏊"],
  ["fitness", "🏋️"],
  ["gym", "🏋️"],
  ["clubhouse", "🏠"],
  ["dog", "🐕"],
  ["playground", "🛝"],
  ["tennis", "🎾"],
  ["basketball", "🏀"],
  ["bbq", "🔥"],
  ["grill", "🔥"],
  ["cowork", "💻"],
  ["co-work", "💻"],
  ["business center", "💻"],
  ["theater", "🎬"],
  ["theatre", "🎬"],
  ["rooftop", "🌆"],
  ["deck", "🌆"],
  ["parking", "🅿️"],
  ["charging", "⚡"],
  ["laundry", "👕"],
  ["package", "📦"],
  ["bike", "🚲"],
  ["conference", "🤝"],
  ["meeting", "🤝"],
  ["spa", "🧖"],
  ["sauna", "🧖"],
];

export function getFacilityIcon(name: string | null | undefined): string {
  if (!name) return DEFAULT_FACILITY_ICON;
  const n = name.toLowerCase();
  const exact = FACILITY_OPTIONS.find((o) => o.label.toLowerCase() === n);
  if (exact) return exact.icon;
  for (const [keyword, icon] of ICON_KEYWORDS) {
    if (n.includes(keyword)) return icon;
  }
  return DEFAULT_FACILITY_ICON;
}
