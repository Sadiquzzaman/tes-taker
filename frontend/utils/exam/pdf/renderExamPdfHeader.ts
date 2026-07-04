import type { jsPDF } from "jspdf";
import { sumSubjectMarks } from "../examMarks";
import { ensureSpace, PDF_LINE_HEIGHT, PDF_PAGE_MARGIN } from "./pdfLayout";
import { getPdfClassLabel } from "./pdfSectionMessages";
import { renderPdfTextBlock, setPdfLatinFont } from "./renderPdfText";

export interface RenderExamPdfHeaderOptions {
  className: string | null;
  durationMinutes: number;
  subject: StudentExamSubject;
  logoBase64: string;
}

export const renderExamPdfHeader = async (
  doc: jsPDF,
  y: number,
  options: RenderExamPdfHeaderOptions,
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_PAGE_MARGIN * 2;
  const totalMarks = sumSubjectMarks(options.subject);
  let cursorY = y;

  doc.setFontSize(10);
  setPdfLatinFont(doc, "normal");
  doc.text(`Time: ${options.durationMinutes} min`, PDF_PAGE_MARGIN, cursorY);

  const logoSize = 14;
  doc.addImage(options.logoBase64, "PNG", pageWidth / 2 - logoSize / 2, cursorY - 4, logoSize, logoSize);

  doc.text(`Marks: ${totalMarks}`, pageWidth - PDF_PAGE_MARGIN, cursorY, { align: "right" });
  cursorY += logoSize + 6;

  const classLabel = getPdfClassLabel(options.className);
  cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 4);
  cursorY = await renderPdfTextBlock(doc, classLabel, pageWidth / 2, cursorY, contentWidth, PDF_LINE_HEIGHT + 2, {
    fontSize: 18,
    style: "bold",
    align: "center",
  });

  const subjectLabel = options.subject.name?.trim() || "Subject";
  cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 3);
  cursorY = await renderPdfTextBlock(doc, subjectLabel, pageWidth / 2, cursorY, contentWidth, PDF_LINE_HEIGHT + 2, {
    fontSize: 14,
    style: "bold",
    align: "center",
  });

  return cursorY + 8;
};
