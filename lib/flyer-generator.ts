import jsPDF from "jspdf";
import { generateQRCodeDataURL } from "./qr-code";

export async function generateWelcomeFlyer(
  communityName: string,
  communityCode: string
): Promise<void> {
  const doc = new jsPDF();

  // Background
  doc.setFillColor(11, 21, 32); // --nly-background dark
  doc.rect(0, 0, 210, 297, "F");

  // Brand header bar
  doc.setFillColor(47, 196, 211); // --nly-brand
  doc.rect(0, 0, 210, 8, "F");

  // Title
  doc.setTextColor(233, 238, 244); // light text
  doc.setFontSize(28);
  doc.text("Welcome to", 105, 45, { align: "center" });

  doc.setFontSize(32);
  doc.setTextColor(47, 196, 211); // brand
  doc.text(communityName, 105, 60, { align: "center" });

  doc.setTextColor(233, 238, 244);
  doc.setFontSize(14);
  doc.text("on Miyora", 105, 72, { align: "center" });

  // Divider line
  doc.setDrawColor(50, 70, 90);
  doc.line(60, 82, 150, 82);

  // Instructions heading
  doc.setFontSize(16);
  doc.setTextColor(233, 238, 244);
  doc.text("How to Join", 105, 98, { align: "center" });

  // Steps
  doc.setFontSize(13);
  doc.setTextColor(180, 195, 210);

  const steps = [
    '1.  Download "Miyora" from the App Store or Google Play',
    "2.  Create your account",
    `3.  Enter community code:  ${communityCode}`,
    "4.  Complete your profile and get approved",
  ];

  let y = 115;
  for (const step of steps) {
    doc.text(step, 30, y);
    y += 12;
  }

  // QR Code section
  doc.setFontSize(12);
  doc.setTextColor(180, 195, 210);
  doc.text("Or scan to join:", 105, y + 10, { align: "center" });

  const qrDataURL = await generateQRCodeDataURL(communityCode, 512);
  doc.addImage(qrDataURL, "PNG", 67.5, y + 16, 75, 75);

  // Community code box
  const codeY = y + 100;
  doc.setFillColor(20, 35, 50);
  doc.roundedRect(55, codeY, 100, 22, 4, 4, "F");

  doc.setFontSize(10);
  doc.setTextColor(180, 195, 210);
  doc.text("COMMUNITY CODE", 105, codeY + 8, { align: "center" });

  doc.setFontSize(18);
  doc.setTextColor(47, 196, 211);
  doc.text(communityCode, 105, codeY + 18, { align: "center" });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100, 120, 140);
  doc.text("Powered by Miyora — miyora-app.com", 105, 285, {
    align: "center",
  });

  // Bottom brand bar
  doc.setFillColor(47, 196, 211);
  doc.rect(0, 289, 210, 8, "F");

  doc.save(`${communityName.replace(/\s+/g, "-")}-welcome-flyer.pdf`);
}
