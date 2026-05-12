export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex nly-auth-bg">
      {/* Left side — Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 md:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1
              className="text-2xl font-bold mb-1 tracking-wide"
              style={{ color: "var(--nly-brand)" }}
            >
              MIYORA
            </h1>
            <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
              Property Manager Portal
            </p>
          </div>
          {children}
        </div>
      </div>

      {/* Right side — Background image with overlay content */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Background image */}
        <img
          src="/images/auth-bg.jpg"
          alt="Modern apartment community"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10, 22, 40, 0.75) 0%, rgba(10, 22, 40, 0.35) 40%, rgba(10, 22, 40, 0.35) 60%, rgba(10, 22, 40, 0.8) 100%)",
          }}
        />

        {/* Content positioned over the image */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top — Header and subheader */}
          <div className="space-y-3 max-w-lg">
            <h2
              className="text-3xl font-bold leading-tight"
              style={{ color: "#fff" }}
            >
              Build Thriving Communities
            </h2>
            <p
              className="text-base leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.8)" }}
            >
              Manage your apartment communities with ease. Engage residents,
              streamline operations, and boost renewals.
            </p>
          </div>

          {/* Bottom — Stats */}
          <div className="flex flex-wrap gap-4 xl:gap-8">
            {[
              { label: "Avg. Engagement", value: "68%" },
              { label: "Renewal Lift", value: "+12%" },
              { label: "Setup Time", value: "<10 min" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="px-5 py-3 rounded-xl"
                style={{ backgroundColor: "rgba(10, 22, 40, 0.6)", backdropFilter: "blur(8px)" }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--nly-brand)" }}
                >
                  {stat.value}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
