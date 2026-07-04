import { jsPDF } from "jspdf";
import { groupExamQuestionsForPdf } from "./pdf/groupExamQuestionsForPdf";
import { loadPdfAssets } from "./pdf/loadPdfAssets";
import { addWatermark, ensureSpace, PDF_PAGE_MARGIN } from "./pdf/pdfLayout";
import { setPdfLatinFont } from "./pdf/renderPdfText";
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
}

export const downloadExamQuestionsPdf = async (options: DownloadExamQuestionsPdfOptions) => {
  const assets = await loadPdfAssets();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
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
  const safeName = (options.testName || "exam").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  doc.save(`${safeName}-questions.pdf`);
};
