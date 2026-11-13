import { jsPDF } from "jspdf";
import { groupExamQuestionsForPdf } from "./pdf/groupExamQuestionsForPdf";
import { loadPdfAssets } from "./pdf/loadPdfAssets";
import { addWatermark, ensureSpace, PDF_LINE_HEIGHT, PDF_PAGE_MARGIN, wrapText } from "./pdf/pdfLayout";
import { renderPdfTextBlock, setPdfLatinFont } from "./pdf/renderPdfText";
import { renderExamPdfHeader } from "./pdf/renderExamPdfHeader";
import {
  renderPassageBlock,
  renderQuestionBlock,
  renderSectionMessage,
} from "./pdf/renderPdfQuestionBlock";

export interface DownloadExamQuestionsPdfOptions {
  testName: string;
  className: string | null;
  durationMinutes: number;
  subjects: StudentExamSubject[];
  /** QA-05: paper size, the set printed (already shuffled by `paperSet`) and the school's name. */
  paper?: "a4" | "legal";
  setLabel?: string | null;
  organizationName?: string | null;
}

export const downloadExamQuestionsPdf = async (options: DownloadExamQuestionsPdfOptions) => {
  const assets = await loadPdfAssets();
  const doc = new jsPDF({ unit: "mm", format: options.paper ?? "a4" });
  setPdfLatinFont(doc, "normal");

  let y = PDF_PAGE_MARGIN;
  let isFirstSubject = true;

  for (const subject of options.subjects) {
    if (!subject.questions.length) {
      continue;
    }

    if (!isFirstSubject) {
      addWatermark(doc);
      doc.addPage();
      y = PDF_PAGE_MARGIN;
    }
    isFirstSubject = false;

    y = await renderExamPdfHeader(doc, y, {
      className: options.className,
      durationMinutes: options.durationMinutes,
      subject,
      logoBase64: assets.logoBase64,
      organizationName: options.organizationName,
      setLabel: options.setLabel,
    });

    const layout = groupExamQuestionsForPdf(subject);
    let questionNumber = 1;

    for (const group of layout.groups) {
      if (group.messageKey) {
        y = await renderSectionMessage(doc, y, group.messageKey, subject);
      }

      for (const question of group.questions) {
        y = await renderQuestionBlock(doc, questionNumber, question, y);
        questionNumber += 1;
      }
    }

    for (const passageBlock of layout.passages) {
      y = await renderSectionMessage(doc, y, "passage", subject);
      const result = await renderPassageBlock(
        doc,
        passageBlock.passage,
        y,
        (child, num, startY) => renderQuestionBlock(doc, num, child, startY),
        questionNumber,
      );
      y = result.y;
      questionNumber = result.nextQuestionNumber;
    }

    y = ensureSpace(doc, y, 8);
  }

  addWatermark(doc);
  doc.save(`${paperFileName(options.testName)}${options.setLabel ? `-set-${options.setLabel}` : ""}-questions.pdf`);
};

const paperFileName = (testName: string) => (testName || "exam").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "exam";

/**
 * The answer key of one set (QA-05), a separate PDF for the teacher: per subject, each question's
 * letter (matching as "1-C, 2-A"); written answers show "—" (marked by the teacher).
 */
export const downloadAnswerKeyPdf = async (options: {
  testName: string;
  organizationName?: string | null;
  setLabel: string;
  paper?: "a4" | "legal";
  key: { subject: StudentExamSubject; rows: { number: number; answer: string | null }[] }[];
}) => {
  const doc = new jsPDF({ unit: "mm", format: options.paper ?? "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_PAGE_MARGIN * 2;
  let y = PDF_PAGE_MARGIN;
  const title = [options.organizationName?.trim(), options.testName].filter(Boolean).join(" — ");
  y = await renderPdfTextBlock(doc, title, pageWidth / 2, y, contentWidth, PDF_LINE_HEIGHT + 1, { fontSize: 13, style: "bold", align: "center" });
  y = await renderPdfTextBlock(doc, `Answer key · Set ${options.setLabel}`, pageWidth / 2, y + 2, contentWidth, PDF_LINE_HEIGHT + 1, { fontSize: 12, style: "bold", align: "center" });
  y += 6;
  const columnWidth = contentWidth / 4;
  for (const { subject, rows } of options.key) {
    if (!rows.length) continue;
    y = ensureSpace(doc, y, PDF_LINE_HEIGHT * 3);
    y = await renderPdfTextBlock(doc, subject.name?.trim() || "Subject", PDF_PAGE_MARGIN, y, contentWidth, PDF_LINE_HEIGHT + 1, { fontSize: 11, style: "bold" });
    y += 2;
    setPdfLatinFont(doc, "normal");
    doc.setFontSize(10);
    // Four answers to a row; matching answers take a whole row.
    let column = 0;
    for (const row of rows) {
      const text = `${row.number}. ${row.answer ?? "—"}`;
      const wide = (row.answer?.length ?? 0) > 8;
      if (wide && column > 0) {
        column = 0;
        y += PDF_LINE_HEIGHT;
      }
      y = ensureSpace(doc, y, PDF_LINE_HEIGHT * 2);
      doc.text(wide ? wrapText(doc, text, contentWidth) : text, PDF_PAGE_MARGIN + column * columnWidth, y);
      if (wide) {
        y += PDF_LINE_HEIGHT * Math.max(1, wrapText(doc, text, contentWidth).length);
        continue;
      }
      column += 1;
      if (column === 4) {
        column = 0;
        y += PDF_LINE_HEIGHT;
      }
    }
    y += column > 0 ? PDF_LINE_HEIGHT + 4 : 4;
  }
  addWatermark(doc);
  doc.save(`${paperFileName(options.testName)}-set-${options.setLabel}-answer-key.pdf`);
};
