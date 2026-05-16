import "server-only";
import { sendEmail } from "@/lib/email/client";
import { deletionRequestReceived } from "@/lib/email/templates/deletion-request-received";
import { corpApprovalRequest } from "@/lib/email/templates/corp-approval-request";
import { corpDecisionNotice } from "@/lib/email/templates/corp-decision-notice";
import { deletionComplete } from "@/lib/email/templates/deletion-complete";

const SUPPORT_EMAIL = "support@neighborlyy.com";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

export function buildApprovalUrl(token: string): string {
  return `${appUrl()}/offboarding/approve?token=${encodeURIComponent(token)}`;
}

export interface SendDeletionRequestReceivedArgs {
  to: string;
  pmFirstName: string;
}

export async function sendDeletionRequestReceived(args: SendDeletionRequestReceivedArgs) {
  const tpl = deletionRequestReceived({ pmFirstName: args.pmFirstName });
  return sendEmail({
    to: args.to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: SUPPORT_EMAIL,
  });
}

export interface SendCorpApprovalRequestArgs {
  to: string;
  kind: "deletion" | "transfer";
  pmName: string;
  orgName: string;
  communityNames: string[];
  approveUrl: string;
  expiresInDays: number;
  incomingPmName?: string;
  incomingPmEmail?: string;
}

export async function sendCorpApprovalRequest(args: SendCorpApprovalRequestArgs) {
  const tpl = corpApprovalRequest(args);
  return sendEmail({
    to: args.to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: SUPPORT_EMAIL,
  });
}

export interface SendCorpDecisionNoticeToPMArgs {
  to: string;
  kind: "deletion" | "transfer";
  decision: "approved" | "denied";
  pmFirstName: string;
  approverName: string;
  nextStepCopy?: string;
}

export async function sendCorpDecisionNoticeToPM(args: SendCorpDecisionNoticeToPMArgs) {
  const tpl = corpDecisionNotice({
    ...args,
    supportEmail: SUPPORT_EMAIL,
  });
  return sendEmail({
    to: args.to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: SUPPORT_EMAIL,
  });
}

export interface SendDeletionCompleteArgs {
  to: string;
  pmFirstName: string;
  communityLines: string[];
  hardDeleteDate: string;
}

export async function sendDeletionComplete(args: SendDeletionCompleteArgs) {
  const tpl = deletionComplete({
    pmFirstName: args.pmFirstName,
    communityLines: args.communityLines,
    hardDeleteDate: args.hardDeleteDate,
    supportEmail: SUPPORT_EMAIL,
  });
  return sendEmail({
    to: args.to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    replyTo: SUPPORT_EMAIL,
  });
}
