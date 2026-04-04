"use client";

import { useEffect } from "react";

interface CommunityThemeProviderProps {
  primaryColor: string | null;
  accentColor: string | null;
}

/**
 * Compute a readable text color (white or dark) for a given background hex.
 * Uses relative luminance per WCAG guidelines.
 */
function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#0B1520" : "#FFFFFF";
}

/**
 * Darken a hex color by a percentage (0-1).
 */
function darken(hex: string, amount: number): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function CommunityThemeProvider({
  primaryColor,
  accentColor,
}: CommunityThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;

    if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      root.style.setProperty("--nly-brand", primaryColor);
      root.style.setProperty("--nly-brand-hover", darken(primaryColor, 0.1));
      root.style.setProperty("--nly-brand-active", darken(primaryColor, 0.2));
      root.style.setProperty(
        "--nly-brand-gradient",
        `linear-gradient(135deg, ${primaryColor} 0%, ${darken(primaryColor, 0.1)} 100%)`
      );
      // Ensure text on brand-colored buttons is readable
      root.style.setProperty("--nly-brand-text", getContrastText(primaryColor));
    }

    if (accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
      root.style.setProperty("--nly-accent", accentColor);
      root.style.setProperty("--nly-accent-hover", darken(accentColor, 0.1));
      root.style.setProperty("--nly-input-border-focus", accentColor);
      root.style.setProperty(
        "--nly-input-focus-glow",
        `rgba(${parseInt(accentColor.slice(1, 3), 16)}, ${parseInt(accentColor.slice(3, 5), 16)}, ${parseInt(accentColor.slice(5, 7), 16)}, 0.15)`
      );
    }

    // Cleanup: restore defaults when unmounting
    return () => {
      root.style.removeProperty("--nly-brand");
      root.style.removeProperty("--nly-brand-hover");
      root.style.removeProperty("--nly-brand-active");
      root.style.removeProperty("--nly-brand-gradient");
      root.style.removeProperty("--nly-brand-text");
      root.style.removeProperty("--nly-accent");
      root.style.removeProperty("--nly-accent-hover");
      root.style.removeProperty("--nly-input-border-focus");
      root.style.removeProperty("--nly-input-focus-glow");
    };
  }, [primaryColor, accentColor]);

  return null;
}
