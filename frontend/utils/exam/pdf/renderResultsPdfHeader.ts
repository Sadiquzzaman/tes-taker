import type { jsPDF } from "jspdf";
import { ensureSpace, PDF_LINE_HEIGHT, PDF_PAGE_MARGIN } from "./pdfLayout";
import { getPdfClassLabel } from "./pdfSectionMessages";
import { renderPdfTextBlock } from "./renderPdfText";

export interface RenderResultsPdfHeaderOptions {
  className: string | null;
  subject: string | null;
  logoBase64: string;
}

export const renderResultsPdfHeader = async (
  doc: jsPDF,
  y: number,
  options: RenderResultsPdfHeaderOptions,
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_PAGE_MARGIN * 2;
  let cursorY = y;

  const logoSize = 14;
  doc.addImage(options.logoBase64, "PNG", pageWidth / 2 - logoSize / 2, cursorY, logoSize, logoSize);
  cursorY += logoSize + 6;

  const classLabel = getPdfClassLabel(options.className);
  cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 4);
  cursorY = await renderPdfTextBlock(doc, classLabel, pageWidth / 2, cursorY, contentWidth, PDF_LINE_HEIGHT + 2, {
    fontSize: 18,
    style: "bold",
    align: "center",
  });

  const subjectLabel = options.subject?.trim() || "Subject";
  cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 3);
  cursorY = await renderPdfTextBlock(doc, subjectLabel, pageWidth / 2, cursorY, contentWidth, PDF_LINE_HEIGHT + 2, {
    fontSize: 14,
    style: "bold",
    align: "center",
  });

  return cursorY + 8;
};
