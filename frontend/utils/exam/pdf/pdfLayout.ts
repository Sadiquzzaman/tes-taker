import type { jsPDF } from "jspdf";
import { PDF_LINE_HEIGHT, PDF_PAGE_MARGIN, PDF_WATERMARK } from "./pdfConstants";
import { setPdfLatinFont } from "./renderPdfText";

export const addWatermark = (doc: jsPDF) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  setPdfLatinFont(doc, "normal");
  doc.setTextColor(180, 180, 180);
  doc.text(PDF_WATERMARK, pageWidth / 2, pageHeight - 10, { align: "center" });
  doc.setTextColor(0, 0, 0);
};

export const ensureSpace = (doc: jsPDF, y: number, needed: number): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - PDF_PAGE_MARGIN) {
    addWatermark(doc);
    doc.addPage();
    return PDF_PAGE_MARGIN;
  }
  return y;
};

export const wrapText = (doc: jsPDF, text: string, maxWidth: number): string[] => {
  return doc.splitTextToSize(text, maxWidth) as string[];
};

export const getContentWidth = (doc: jsPDF): number => {
  return doc.internal.pageSize.getWidth() - PDF_PAGE_MARGIN * 2;
};

export { PDF_LINE_HEIGHT, PDF_PAGE_MARGIN };
