import { emailShell, ctaButton, escapeHtml, EMAIL_COLORS } from "./_layout";

export interface CorpApprovalRequestInput {
  kind: "deletion" | "transfer";
  pmName: string;
  orgName: string;
  communityNames: string[];
  approveUrl: string;
  denyUrl?: string;
  expiresInDays: number;
  incomingPmName?: string;
  incomingPmEmail?: string;
}

export function corpApprovalRequest(input: CorpApprovalRequestInput) {
  const isDeletion = input.kind === "deletion";
  const headline = isDeletion
    ? "A property manager has requested to close their Miyora account"
    : "A property manager has requested to transfer their Miyora account";

  const subject = isDeletion
    ? `Action required: ${input.pmName} requested to close their Miyora account`
    : `Action required: ${input.pmName} requested an account transfer`;

  const communitiesList = input.communityNames.length
    ? `<ul style="margin:8px 0 16px 18px;padding:0;">${input.communityNames
        .map((c) => `<li style="margin:0 0 4px;">${escapeHtml(c)}</li>`)
        .join("")}</ul>`
    : `<p style="margin:0 0 16px;color:${EMAIL_COLORS.TEXT_SECONDARY};">No active communities on file.</p>`;

  const transferDetails =
    !isDeletion && input.incomingPmEmail
      ? `<p style="margin:0 0 8px;"><strong>Incoming PM:</strong> ${escapeHtml(input.incomingPmName || "")} &lt;${escapeHtml(input.incomingPmEmail)}&gt;</p>`
      : "";

  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 8px;"><strong>Property manager:</strong> ${escapeHtml(input.pmName)}</p>
    <p style="margin:0 0 8px;"><strong>Organization:</strong> ${escapeHtml(input.orgName)}</p>
    ${transferDetails}
    <p style="margin:16px 0 4px;font-weight:600;">Communities affected:</p>
    ${communitiesList}
    <p style="margin:0 0 16px;">This request will not change anything until you authorize it. Click below to review and decide.</p>
    <p style="margin:24px 0 8px;">${ctaButton(input.approveUrl, "Review the request")}</p>
    <p style="margin:0;color:${EMAIL_COLORS.TEXT_SECONDARY};font-size:12px;">This link expires in ${input.expiresInDays} days. If you do nothing, the request will lapse and the PM will be notified.</p>
  `;

  const html = emailShell({
    preheader: isDeletion
      ? "A PM has asked to close their account. Your approval is required."
      : "A PM has asked to transfer their account. Your approval is required.",
    body,
    footerNote: `<p style="margin:0 0 4px;">If the button does not work, paste this URL into your browser:</p><p style="margin:0;word-break:break-all;color:${EMAIL_COLORS.TEXT_SECONDARY};">${escapeHtml(input.approveUrl)}</p>`,
  });

  const text =
    `${headline}\n\n` +
    `Property manager: ${input.pmName}\n` +
    `Organization: ${input.orgName}\n` +
    (transferDetails && input.incomingPmEmail
      ? `Incoming PM: ${input.incomingPmName ?? ""} <${input.incomingPmEmail}>\n`
      : "") +
    (input.communityNames.length
      ? `Communities: ${input.communityNames.join(", ")}\n`
      : "") +
    `\nReview and decide: ${input.approveUrl}\n\n` +
    `This link expires in ${input.expiresInDays} days.`;

  return { subject, html, text };
}
