import { emailShell, escapeHtml } from "./_layout";

export interface DeletionRequestReceivedInput {
  pmFirstName: string;
}

export function deletionRequestReceived(input: DeletionRequestReceivedInput) {
  const name = escapeHtml(input.pmFirstName || "there");
  const subject = "We received your account deletion request";
  const html = emailShell({
    preheader: "Your corporation must approve before anything is changed.",
    body: `
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Your deletion request was received</h1>
      <p style="margin:0 0 16px;">Hi ${name},</p>
      <p style="margin:0 0 16px;">We've received your request to delete your Neighborlyy account. Nothing has changed yet.</p>
      <p style="margin:0 0 16px;">Your corporation has been emailed and must approve this request before we proceed. You'll get another email when they decide.</p>
      <p style="margin:0 0 8px;">If you change your mind, you can cancel this request from your account settings at any time before it completes.</p>
    `,
  });
  const text =
    `Hi ${input.pmFirstName || "there"},\n\n` +
    `We've received your request to delete your Neighborlyy account. Nothing has changed yet.\n\n` +
    `Your corporation has been emailed and must approve this request before we proceed. You'll get another email when they decide.\n\n` +
    `If you change your mind, you can cancel this request from your account settings at any time.`;
  return { subject, html, text };
}
