import { PDF_LOGO_PATH } from "./pdfConstants";

export interface PdfAssets {
  logoBase64: string;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

export const loadPdfAssets = async (): Promise<PdfAssets> => {
  const logoResponse = await fetch(PDF_LOGO_PATH);

  if (!logoResponse.ok) {
    throw new Error("Failed to load PDF logo");
  }

  const logoBuffer = await logoResponse.arrayBuffer();

  return {
    logoBase64: arrayBufferToBase64(logoBuffer),
  };
};
