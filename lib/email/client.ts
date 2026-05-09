import "server-only";
import { Resend } from "resend";

let cached: Resend | null = null;

function getClient(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  cached = new Resend(apiKey);
  return cached;
}

function getFrom(): string {
  return process.env.RESEND_FROM_EMAIL || "Neighborlyy <onboarding@resend.dev>";
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput) {
  const client = getClient();
  const { error, data } = await client.emails.send({
    from: getFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message ?? "unknown error"}`);
  }

  return data;
}
