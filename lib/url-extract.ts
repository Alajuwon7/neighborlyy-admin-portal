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

/**
 * Fetches a property website and extracts metadata:
 * - Property name from <title> or og:title
 * - Address from structured data or meta tags
 * - Brand colors from theme-color meta or CSS
 */
export async function extractFromUrl(url: string): Promise<ExtractedSiteData> {
  const result: ExtractedSiteData = {};

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Neighborlyy/1.0 (Property Setup)" },
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

    // Extract theme color
    const themeColor = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)?.[1];
    if (themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor)) {
      result.primaryColor = themeColor;
    }

    // Try to extract colors from inline CSS custom properties
    if (!result.primaryColor) {
      const cssColors = html.match(/--(?:primary|brand|main)[-_]?color\s*:\s*(#[0-9a-f]{3,8})/gi);
      if (cssColors && cssColors.length > 0) {
        const color = cssColors[0].match(/#[0-9a-f]{3,8}/i)?.[0];
        if (color) result.primaryColor = color;
      }
    }

    // Extract accent/secondary color
    const accentMatch = html.match(/--(?:accent|secondary)[-_]?color\s*:\s*(#[0-9a-f]{3,8})/gi);
    if (accentMatch && accentMatch.length > 0) {
      const color = accentMatch[0].match(/#[0-9a-f]{3,8}/i)?.[0];
      if (color) result.accentColor = color;
    }

  } catch {
    // Fetch failed, timeout, etc. — return empty result
  }

  return result;
}
