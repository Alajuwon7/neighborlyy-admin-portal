import Image from "next/image";
import { AuthHeroStats } from "@/components/auth/AuthHeroStats";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex nly-auth-bg">
      {/* Left side — Form.
          Top-anchored (items-start) so the tabs + heading hold a fixed vertical
          position when the form height changes between Sign In and Sign Up —
          otherwise vertical centering re-centers the whole block and it "jumps". */}
      <div className="relative flex-1 flex items-start justify-center px-4 py-10 sm:px-6 sm:py-12 md:px-8 lg:py-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1
              className="font-serif text-4xl font-semibold mb-1 tracking-[0.12em]"
              style={{ color: "#fff" }}
            >
              MIYORA
            </h1>
            <p className="text-sm" style={{ color: "var(--nly-text-secondary)" }}>
              Your home, your light, your moment.
            </p>
          </div>
          {children}
        </div>

        {/* Pinned footer */}
        <p
          className="absolute bottom-6 inset-x-0 text-center text-xs tracking-wide"
          style={{ color: "var(--nly-text-tertiary)" }}
        >
          Property Manager Portal
        </p>
      </div>

      {/* Right side — Background image with overlay content */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Background image */}
        <Image
          src="/images/auth-bg.jpg"
          alt="Diverse residents relaxing together in a sunlit luxury apartment lounge"
          fill
          priority
          sizes="50vw"
          className="object-cover"
          style={{ filter: "brightness(1.12) saturate(1.05)" }}
        />

        {/* Gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10, 22, 40, 0.58) 0%, rgba(10, 22, 40, 0.5) 22%, rgba(10, 22, 40, 0.1) 45%, rgba(10, 22, 40, 0.1) 62%, rgba(10, 22, 40, 0.66) 100%)",
          }}
        />

        {/* Content positioned over the image */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top — Header and subheader */}
          <div
            className="space-y-3 max-w-lg"
            style={{ textShadow: "0 1px 14px rgba(10, 22, 40, 0.55)" }}
          >
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
          <AuthHeroStats />
        </div>
      </div>
    </div>
  );
}
