interface ShellOptions {
  preheader?: string;
  body: string;
  footerNote?: string;
}

const BRAND_PRIMARY = "#2FC4D3";
const SURFACE = "#0E1A2C";
const TEXT_PRIMARY = "#0E1A2C";
const TEXT_SECONDARY = "#4A5A75";
const BORDER = "#E1E7F0";

export function emailShell({ preheader, body, footerNote }: ShellOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Miyora</title>
  </head>
  <body style="margin:0;padding:0;background:#F2F5FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_PRIMARY};">
    ${preheader ? `<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F5FA;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:${SURFACE};padding:20px 24px;">
                <span style="color:${BRAND_PRIMARY};font-weight:700;font-size:18px;letter-spacing:.04em;">MIYORA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 16px 28px;font-size:15px;line-height:1.55;color:${TEXT_PRIMARY};">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px 28px;font-size:12px;line-height:1.5;color:${TEXT_SECONDARY};">
                ${footerNote ? footerNote : ""}
                <p style="margin:16px 0 0;">If you weren't expecting this email, you can safely ignore it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function ctaButton(href: string, label: string, color = BRAND_PRIMARY): string {
  return `<a href="${escapeAttr(href)}" style="display:inline-block;background:${color};color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">${escapeHtml(label)}</a>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

export const EMAIL_COLORS = {
  BRAND_PRIMARY,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BORDER,
} as const;
