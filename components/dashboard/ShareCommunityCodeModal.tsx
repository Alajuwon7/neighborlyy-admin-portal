"use client";

import { useEffect, useState } from "react";
import { X, Copy, Mail, Download, Share2, FileText } from "lucide-react";
import { toast } from "sonner";
import { generateQRCodeDataURL, downloadQRCode } from "@/lib/qr-code";
import { generateWelcomeFlyer } from "@/lib/flyer-generator";

interface ShareCommunityCodeModalProps {
  communityCode: string;
  communityName: string;
  open: boolean;
  onClose: () => void;
}

export function ShareCommunityCodeModal({
  communityCode,
  communityName,
  open,
  onClose,
}: ShareCommunityCodeModalProps) {
  const [qrDataURL, setQrDataURL] = useState<string | null>(null);
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  useEffect(() => {
    if (open && !qrDataURL) {
      generateQRCodeDataURL(communityCode, 256).then(setQrDataURL);
    }
  }, [open, communityCode, qrDataURL]);

  if (!open) return null;

  const emailTemplate = `Hi there!

I'm inviting you to join our community on Miyora. It's the easiest way to stay connected with neighbors, reserve amenities, and get important updates.

To get started:
1. Download the Miyora app
2. Create your account
3. Enter this community code: ${communityCode}

Welcome to ${communityName}!`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(communityCode);
      toast.success("Community code copied!");
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailTemplate);
      toast.success("Email invite copied!");
    } catch {
      toast.error("Failed to copy template");
    }
  };

  const handleDownloadQR = async () => {
    try {
      await downloadQRCode(communityCode, `${communityCode}-qr-code.png`);
      toast.success("QR code downloaded!");
    } catch {
      toast.error("Failed to download QR code");
    }
  };

  const handleDownloadFlyer = async () => {
    setGeneratingFlyer(true);
    try {
      await generateWelcomeFlyer(communityName, communityCode);
      toast.success("Welcome flyer downloaded!");
    } catch {
      toast.error("Failed to generate flyer");
    } finally {
      setGeneratingFlyer(false);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `Join ${communityName} on Miyora`,
        text: `Join our community on Miyora! Use code: ${communityCode}`,
        url: "https://miyora-app.com",
      });
    } catch (err: unknown) {
      // User cancelled share — not an error
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Failed to share");
      }
    }
  };

  const secondaryBtn =
    "flex-1 min-w-[120px] h-10 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--nly-text-primary)" }}
            >
              Share community
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Invite residents to {communityName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
            style={{ color: "var(--nly-text-tertiary)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Two cards: Share code | Scan to join */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Share code */}
          <div
            className="rounded-xl border p-4 flex flex-col"
            style={{ borderColor: "var(--nly-border)" }}
          >
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              Share code
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Residents enter this to join
            </p>
            <div
              className="mt-3 flex items-center gap-2 rounded-lg border px-3 h-11"
              style={{
                backgroundColor: "var(--nly-input-bg)",
                borderColor: "var(--nly-border)",
              }}
            >
              <span
                className="flex-1 font-mono font-bold tracking-widest text-base truncate"
                style={{ color: "var(--nly-input-text)" }}
              >
                {communityCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="shrink-0 transition-opacity hover:opacity-70"
                style={{ color: "var(--nly-input-text)" }}
                aria-label="Copy community code"
              >
                <Copy size={16} />
              </button>
            </div>
            <button
              onClick={handleCopyCode}
              className="mt-3 h-10 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--nly-brand)", color: "#fff" }}
            >
              <Copy size={15} />
              Copy code
            </button>
          </div>

          {/* Scan to join */}
          <div
            className="rounded-xl border p-4 flex flex-col items-center"
            style={{ borderColor: "var(--nly-border)" }}
          >
            <p
              className="text-xs font-semibold self-start"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              Scan to join
            </p>
            <div
              className="mt-3 rounded-xl border p-2.5"
              style={{
                backgroundColor: "var(--nly-input-bg)",
                borderColor: "var(--nly-border)",
              }}
            >
              {qrDataURL ? (
                <img
                  src={qrDataURL}
                  alt={`QR code to join ${communityName}`}
                  className="rounded-md w-32 h-32 sm:w-36 sm:h-36"
                />
              ) : (
                <div
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: "var(--nly-border)" }}
                >
                  <p
                    className="text-xs"
                    style={{ color: "var(--nly-input-text)" }}
                  >
                    Generating…
                  </p>
                </div>
              )}
            </div>
            <p
              className="text-xs text-center mt-2"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              Scan to join {communityName}
            </p>
            <button
              onClick={handleDownloadQR}
              className="mt-2 text-xs font-medium flex items-center gap-1.5 transition-opacity hover:opacity-70"
              style={{ color: "var(--nly-text-secondary)" }}
            >
              <Download size={13} />
              Download QR
            </button>
          </div>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopyEmail}
            className={secondaryBtn}
            style={{
              borderColor: "var(--nly-border)",
              color: "var(--nly-text-secondary)",
            }}
          >
            <Mail size={14} />
            Copy email invite
          </button>
          <button
            onClick={handleDownloadFlyer}
            disabled={generatingFlyer}
            className={`${secondaryBtn} disabled:opacity-50`}
            style={{
              borderColor: "var(--nly-border)",
              color: "var(--nly-text-secondary)",
            }}
          >
            <FileText size={14} />
            {generatingFlyer ? "Generating…" : "Print flyer"}
          </button>
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className={secondaryBtn}
              style={{
                borderColor: "var(--nly-border)",
                color: "var(--nly-text-secondary)",
              }}
            >
              <Share2 size={14} />
              Share
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl font-medium text-sm transition-opacity hover:opacity-80 border"
          style={{
            borderColor: "var(--nly-border)",
            color: "var(--nly-text-secondary)",
            backgroundColor: "transparent",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
