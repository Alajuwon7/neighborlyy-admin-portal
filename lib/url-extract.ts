"use server";

export interface ExtractedSiteData {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  primaryColor?: string;
  accentColor?: string;
}

/** Convert 3-char hex to 6-char */
function normalizeHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
  return `#${h.slice(0, 6)}`.toUpperCase();
}

/** Check if a color is too neutral (black, white, near-gray) to be a brand color */
function isNeutral(hex: string): boolean {
  const h = normalizeHex(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Too dark or too light
  if (r + g + b < 60 || r + g + b > 700) return true;
  // Near-gray: all channels within 30 of each other
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread < 30;
}

/** Extract the most common non-neutral colors from HTML */
function extractColorsFromHtml(html: string): { primary?: string; accent?: string } {
  const colorCounts = new Map<string, number>();

  // 1. theme-color meta tag (highest priority)
  const themeColor = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor) && !isNeutral(themeColor)) {
    return { primary: normalizeHex(themeColor) };
  }

  // 2. CSS custom properties (broad matching)
  const cssVarPatterns = /--[\w-]*(?:primary|brand|main|accent|secondary|theme|color-1|color-2|highlight)[\w-]*\s*:\s*(#[0-9a-f]{3,8})/gi;
  let match;
  while ((match = cssVarPatterns.exec(html)) !== null) {
    const color = normalizeHex(match[1]);
    if (!isNeutral(color)) {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 5); // boost CSS vars
    }
  }

  // 3. Inline style colors (background-color, color, border-color)
  const inlineColorPattern = /(?:background-color|(?<!-)color|border-color)\s*:\s*(#[0-9a-f]{3,8})/gi;
  while ((match = inlineColorPattern.exec(html)) !== null) {
    const color = normalizeHex(match[1]);
    if (!isNeutral(color)) {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }
  }

  // 4. RGB/RGBA colors in styles
  const rgbPattern = /(?:background-color|(?<!-)color)\s*:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi;
  while ((match = rgbPattern.exec(html)) !== null) {
    const hex = `#${parseInt(match[1]).toString(16).padStart(2, "0")}${parseInt(match[2]).toString(16).padStart(2, "0")}${parseInt(match[3]).toString(16).padStart(2, "0")}`.toUpperCase();
    if (!isNeutral(hex)) {
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
  }

  // 5. Hex colors in style blocks and inline styles
  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  for (const block of styleBlocks) {
    const hexPattern = /#[0-9a-f]{3,6}(?![0-9a-f])/gi;
    while ((match = hexPattern.exec(block)) !== null) {
      if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(match[0])) {
        const color = normalizeHex(match[0]);
        if (!isNeutral(color)) {
          colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
        }
      }
    }
  }

  // Sort by frequency, pick top 2 distinct colors
  const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const primary = sorted[0]?.[0];
  const accent = sorted.find(([c]) => c !== primary)?.[0];

  return { primary, accent };
}

/**
 * Fetches a property website and extracts metadata:
 * - Property name from <title> or og:title
 * - Address from structured data or meta tags
 * - Brand colors from theme-color, CSS variables, inline styles, and style blocks
 */
export async function extractFromUrl(url: string): Promise<ExtractedSiteData> {
  const result: ExtractedSiteData = {};

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Miyora/1.0 (Property Setup)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return result;

    const html = await res.text();

    // Extract property name from <title> or og:title
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const siteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1];

    const rawName = ogTitle || siteName || titleTag || "";
    // Clean up common suffixes
    const cleanName = rawName
      .replace(/\s*[-|–—]\s*(apartments?|residences?|living|home|welcome).*$/i, "")
      .replace(/\s*[-|–—]\s*$/i, "")
      .trim();

    if (cleanName && cleanName.length < 60) {
      result.name = cleanName;
    }

    // Extract address from structured data (JSON-LD)
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const jsonStr = block.replace(/<\/?script[^>]*>/gi, "");
          const data = JSON.parse(jsonStr);
          const address = data.address || data?.location?.address;
          if (address) {
            result.address = address.streetAddress || undefined;
            result.city = address.addressLocality || undefined;
            result.state = address.addressRegion || undefined;
            result.zip = address.postalCode || undefined;
            break;
          }
        } catch {
          // Invalid JSON-LD, skip
        }
      }
    }

    // Extract brand colors
    const colors = extractColorsFromHtml(html);
    if (colors.primary) result.primaryColor = colors.primary;
    if (colors.accent) result.accentColor = colors.accent;

  } catch {
    // Fetch failed, timeout, etc. — return empty result
  }

  return result;
}
