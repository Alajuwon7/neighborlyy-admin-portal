interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: "Property Info" },
  { number: 2, label: "Branding" },
  { number: 3, label: "Facilities" },
  { number: 4, label: "Admin Access" },
  { number: 5, label: "Billing" },
];

interface StepProgressProps {
  currentStep: number;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Connector line */}
        <div
          className="absolute top-5 left-0 right-0 h-0.5"
          style={{ backgroundColor: "var(--nly-border)" }}
        />
        <div
          className="absolute top-5 left-0 h-0.5 transition-all duration-500"
          style={{
            backgroundColor: "var(--nly-brand)",
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {STEPS.map((step) => {
          const isDone = step.number < currentStep;
          const isActive = step.number === currentStep;

          return (
            <div key={step.number} className="flex flex-col items-center z-10 gap-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300"
                style={{
                  backgroundColor: isDone
                    ? "var(--nly-brand)"
                    : isActive
                    ? "var(--nly-brand)"
                    : "var(--nly-surface)",
                  color: isDone || isActive ? "#fff" : "var(--nly-text-tertiary)",
                  border: `2px solid ${
                    isDone || isActive ? "var(--nly-brand)" : "var(--nly-border)"
                  }`,
                  boxShadow: isActive ? "0 0 12px rgba(230, 92, 79, 0.3)" : "none",
                }}
              >
                {isDone ? "✓" : step.number}
              </div>
              <span
                className="text-xs font-medium hidden sm:block"
                style={{
                  color: isActive
                    ? "var(--nly-text-primary)"
                    : "var(--nly-text-tertiary)",
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
