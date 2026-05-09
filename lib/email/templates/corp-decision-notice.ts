import { emailShell, escapeHtml } from "./_layout";

export interface CorpDecisionNoticeInput {
  kind: "deletion" | "transfer";
  decision: "approved" | "denied";
  pmFirstName: string;
  approverName: string;
  nextStepCopy?: string;
  supportEmail?: string;
}

export function corpDecisionNotice(input: CorpDecisionNoticeInput) {
  const name = escapeHtml(input.pmFirstName || "there");
  const approver = escapeHtml(input.approverName || "your corporation");
  const isDeletion = input.kind === "deletion";
  const isApprove = input.decision === "approved";

  const subject = isApprove
    ? isDeletion
      ? "Your account deletion was approved"
      : "Your account transfer was approved"
    : isDeletion
      ? "Your account deletion was denied"
      : "Your account transfer was denied";

  const heading = isApprove
    ? `${approver} approved your request`
    : `${approver} denied your request`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">${heading}</h1>
    <p style="margin:0 0 16px;">Hi ${name},</p>
    ${
      isApprove
        ? `<p style="margin:0 0 16px;">Your ${isDeletion ? "deletion" : "transfer"} request has been approved by your corporation. ${
            input.nextStepCopy
              ? escapeHtml(input.nextStepCopy)
              : "You'll see the next step waiting for you in your account settings."
          }</p>`
        : `<p style="margin:0 0 16px;">Your ${isDeletion ? "deletion" : "transfer"} request was denied. No changes have been made to your account.</p><p style="margin:0 0 16px;">If you believe this was a mistake, please reach out to your corporation directly.</p>`
    }
    ${
      input.supportEmail
        ? `<p style="margin:0 0 8px;color:#4A5A75;font-size:13px;">Questions? Email <a href="mailto:${escapeHtml(input.supportEmail)}" style="color:#2FC4D3;">${escapeHtml(input.supportEmail)}</a>.</p>`
        : ""
    }
  `;

  const html = emailShell({
    preheader: isApprove
      ? "Your corporation approved the request."
      : "Your corporation denied the request.",
    body,
  });

  const text =
    `Hi ${input.pmFirstName || "there"},\n\n` +
    (isApprove
      ? `Your ${isDeletion ? "deletion" : "transfer"} request was approved by ${input.approverName || "your corporation"}.\n`
      : `Your ${isDeletion ? "deletion" : "transfer"} request was denied. No changes have been made to your account.\n`) +
    (isApprove && input.nextStepCopy
      ? `\n${input.nextStepCopy}\n`
      : "") +
    (input.supportEmail ? `\nQuestions? Email ${input.supportEmail}` : "");

  return { subject, html, text };
}
