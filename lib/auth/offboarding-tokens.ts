import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export type OffboardingTokenKind = "deletion" | "transfer";

export interface OffboardingTokenPayload {
  kind: OffboardingTokenKind;
  request_id: string;
  org_id: string;
  jti: string;
}

const ISSUER = "neighborlyy-admin-portal";
const AUDIENCE = "neighborlyy-offboarding";

function getSecret(): Uint8Array {
  const raw = process.env.OFFBOARDING_APPROVAL_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "OFFBOARDING_APPROVAL_SECRET must be set to a 32+ character secret",
    );
  }
  return new TextEncoder().encode(raw);
}

export interface SignedApprovalToken {
  token: string;
  jti: string;
}

export async function signApprovalToken(
  payload: Omit<OffboardingTokenPayload, "jti">,
  ttlSeconds: number,
): Promise<SignedApprovalToken> {
  const jti = randomUUID();
  const token = await new SignJWT({
    kind: payload.kind,
    request_id: payload.request_id,
    org_id: payload.org_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getSecret());
  return { token, jti };
}

export type VerifyResult =
  | { ok: true; payload: OffboardingTokenPayload }
  | { ok: false; reason: "expired" | "invalid" };

export async function verifyApprovalToken(token: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (
      typeof payload.kind !== "string" ||
      (payload.kind !== "deletion" && payload.kind !== "transfer") ||
      typeof payload.request_id !== "string" ||
      typeof payload.org_id !== "string" ||
      typeof payload.jti !== "string"
    ) {
      return { ok: false, reason: "invalid" };
    }

    return {
      ok: true,
      payload: {
        kind: payload.kind,
        request_id: payload.request_id,
        org_id: payload.org_id,
        jti: payload.jti,
      },
    };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "ERR_JWT_EXPIRED") return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}

export const TOKEN_TTL = {
  CORP_APPROVAL_SECONDS: 14 * 24 * 60 * 60,
  TRANSFER_INVITE_SECONDS: 7 * 24 * 60 * 60,
} as const;
