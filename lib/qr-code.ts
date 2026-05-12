import QRCode from "qrcode";

export async function generateQRCodeDataURL(
  communityCode: string,
  size = 256
): Promise<string> {
  const data = `miyora://join/${communityCode}`;

  return QRCode.toDataURL(data, {
    width: size,
    margin: 2,
    color: {
      dark: "#0B1520",
      light: "#E9EEF4",
    },
  });
}

export async function downloadQRCode(
  communityCode: string,
  filename = "community-qr-code.png"
): Promise<void> {
  const dataURL = await generateQRCodeDataURL(communityCode, 512);

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataURL;
  link.click();
}
