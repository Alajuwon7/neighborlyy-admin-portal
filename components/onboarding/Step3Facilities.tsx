const FACILITY_OPTIONS = [
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

export interface Step3Data {
  facilities: string[];
}

interface Props {
  data: Step3Data;
  onChange: (data: Partial<Step3Data>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3Facilities({ data, onChange, onNext, onBack }: Props) {
  const toggle = (id: string) => {
    const current = data.facilities;
    onChange({
      facilities: current.includes(id)
        ? current.filter((f) => f !== id)
        : [...current, id],
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
        Select all amenities available at your community. Residents will see
        these in the app and can book them directly.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FACILITY_OPTIONS.map((facility) => {
          const selected = data.facilities.includes(facility.id);
          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => toggle(facility.id)}
              className="flex items-center gap-2 p-3 rounded-xl border text-left transition-all"
              style={{
                backgroundColor: selected ? "rgba(230, 92, 79, 0.08)" : "var(--nly-surface)",
                borderColor: selected ? "var(--nly-brand)" : "var(--nly-border)",
                color: selected ? "var(--nly-text-primary)" : "var(--nly-text-secondary)",
              }}
            >
              <span className="text-lg">{facility.icon}</span>
              <span className="text-xs font-medium">{facility.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
        {data.facilities.length} selected · You can add more later in settings.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-11 rounded-lg font-semibold text-sm border transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-secondary)",
            backgroundColor: "transparent",
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 h-11 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
