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

I'm inviting you to join our community on Neighborlyy. It's the easiest way to stay connected with neighbors, reserve amenities, and get important updates.

To get started:
1. Download the Neighborlyy app
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
      toast.success("Email template copied!");
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
        title: `Join ${communityName} on Neighborlyy`,
        text: `Join our community on Neighborlyy! Use code: ${communityCode}`,
        url: "https://neighborlyy.com",
      });
    } catch (err: unknown) {
      // User cancelled share — not an error
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Failed to share");
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--nly-surface)",
          borderColor: "var(--nly-border)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--nly-text-primary)" }}
          >
            Share Community Code
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
            style={{ color: "var(--nly-text-tertiary)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section 1: Code display + copy */}
        <div
          className="rounded-xl p-4 sm:p-5 text-center border"
          style={{
            backgroundColor: "var(--nly-input-bg)",
            borderColor: "var(--nly-border)",
          }}
        >
          <p
            className="text-xs font-semibold mb-2"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            COMMUNITY CODE
          </p>
          <p
            className="text-2xl sm:text-3xl font-mono font-bold tracking-widest"
            style={{ color: "var(--nly-brand)" }}
          >
            {communityCode}
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            Residents enter this code to join {communityName}
          </p>
        </div>

        <button
          onClick={handleCopyCode}
          className="w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{
            backgroundColor: "var(--nly-brand)",
            color: "#fff",
          }}
        >
          <Copy size={16} />
          Copy Community Code
        </button>

        {/* Section 2: QR Code */}
        <div className="space-y-2">
          <p
            className="text-xs font-semibold"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            QR CODE
          </p>
          <div
            className="rounded-xl p-4 border flex flex-col items-center gap-3"
            style={{
              backgroundColor: "var(--nly-input-bg)",
              borderColor: "var(--nly-border)",
            }}
          >
            {qrDataURL ? (
              <img
                src={qrDataURL}
                alt={`QR code to join ${communityName}`}
                className="rounded-lg w-36 h-36 sm:w-44 sm:h-44"
              />
            ) : (
              <div
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--nly-border)" }}
              >
                <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                  Generating...
                </p>
              </div>
            )}
            <p className="text-xs text-center" style={{ color: "var(--nly-text-tertiary)" }}>
              Residents can scan this to download the app and join
            </p>
            <button
              onClick={handleDownloadQR}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--nly-border)",
                color: "var(--nly-text-secondary)",
              }}
            >
              <Download size={14} />
              Download QR Code
            </button>
          </div>
        </div>

        {/* Section 3: Email template */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p
              className="text-xs font-semibold flex items-center gap-1.5"
              style={{ color: "var(--nly-text-tertiary)" }}
            >
              <Mail size={12} />
              EMAIL TEMPLATE
            </p>
            <button
              onClick={handleCopyEmail}
              className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: "var(--nly-brand)" }}
            >
              <Copy size={10} />
              Copy
            </button>
          </div>
          <div
            className="rounded-xl p-4 border text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              backgroundColor: "var(--nly-input-bg)",
              borderColor: "var(--nly-border)",
              color: "var(--nly-text-secondary)",
              maxHeight: "150px",
              overflowY: "auto",
            }}
          >
            {emailTemplate}
          </div>
        </div>

        {/* Section 4: Printable materials */}
        <div className="space-y-2">
          <p
            className="text-xs font-semibold"
            style={{ color: "var(--nly-text-tertiary)" }}
          >
            PRINTABLE MATERIALS
          </p>
          <button
            onClick={handleDownloadFlyer}
            disabled={generatingFlyer}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              borderColor: "var(--nly-border)",
              backgroundColor: "var(--nly-input-bg)",
            }}
          >
            <FileText size={18} style={{ color: "var(--nly-brand)" }} />
            <div className="text-left">
              <p className="text-sm font-medium" style={{ color: "var(--nly-text-primary)" }}>
                {generatingFlyer ? "Generating..." : "Download Welcome Flyer"}
              </p>
              <p className="text-xs" style={{ color: "var(--nly-text-tertiary)" }}>
                PDF with QR code and join instructions — print and post in your building
              </p>
            </div>
          </button>
        </div>

        {/* Section 5: Native share (mobile) */}
        {canNativeShare && (
          <button
            onClick={handleNativeShare}
            className="w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border transition-opacity hover:opacity-80"
            style={{
              borderColor: "var(--nly-border)",
              color: "var(--nly-text-secondary)",
              backgroundColor: "transparent",
            }}
          >
            <Share2 size={16} />
            Share via WhatsApp, SMS, or more...
          </button>
        )}

        {/* Close button */}
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
