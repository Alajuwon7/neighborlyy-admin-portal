import { emailShell, escapeHtml } from "./_layout";

export interface DeletionCompleteInput {
  pmFirstName: string;
  /** One line per community, e.g. "Maple Ridge — Suspended (awaiting a new property manager)" */
  communityLines: string[];
  /** Human-readable date the 30-day window ends, e.g. "June 13, 2026" */
  hardDeleteDate: string;
  supportEmail: string;
}

export function deletionComplete(input: DeletionCompleteInput) {
  const name = escapeHtml(input.pmFirstName || "there");
  const subject = "Your Miyora account has been closed";

  const communityItems = input.communityLines.length
    ? input.communityLines
        .map((line) => `<li style="margin:0 0 4px;">${escapeHtml(line)}</li>`)
        .join("")
    : `<li style="margin:0 0 4px;">No communities required handoff.</li>`;

  const html = emailShell({
    preheader: "Your account is closed. Community data is retained for 30 days.",
    body: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Your account has been closed</h1>
      <p style="margin:0 0 16px;">Hi ${name},</p>
      <p style="margin:0 0 16px;">Your Miyora property manager account has been closed. Here's what happened:</p>
      <p style="margin:0 0 8px;font-weight:600;">Communities</p>
      <ul style="margin:0 0 16px;padding-left:20px;">${communityItems}</ul>
      <p style="margin:0 0 8px;font-weight:600;">Your data</p>
      <ul style="margin:0 0 16px;padding-left:20px;">
        <li style="margin:0 0 4px;">Your name, email, and phone number have been wiped.</li>
        <li style="margin:0 0 4px;">Your login has been disabled.</li>
        <li style="margin:0 0 4px;">Your residents' accounts and history are fully preserved.</li>
        <li style="margin:0 0 4px;">A compliance record of this process is retained.</li>
      </ul>
      <p style="margin:0 0 16px;">Your community data will be permanently deleted on <strong>${escapeHtml(input.hardDeleteDate)}</strong>. If you need a data export before then, email <a href="mailto:${escapeHtml(input.supportEmail)}">${escapeHtml(input.supportEmail)}</a>.</p>
      <p style="margin:0 0 8px;">Thank you for using Miyora.</p>
    `,
  });

  const text =
    `Hi ${input.pmFirstName || "there"},\n\n` +
    `Your Miyora property manager account has been closed.\n\n` +
    `Communities:\n` +
    (input.communityLines.length
      ? input.communityLines.map((l) => `  - ${l}`).join("\n")
      : "  - No communities required handoff.") +
    `\n\nYour data:\n` +
    `  - Your name, email, and phone number have been wiped.\n` +
    `  - Your login has been disabled.\n` +
    `  - Your residents' accounts and history are fully preserved.\n` +
    `  - A compliance record of this process is retained.\n\n` +
    `Your community data will be permanently deleted on ${input.hardDeleteDate}. ` +
    `If you need a data export before then, email ${input.supportEmail}.\n\n` +
    `Thank you for using Miyora.`;

  return { subject, html, text };
}
