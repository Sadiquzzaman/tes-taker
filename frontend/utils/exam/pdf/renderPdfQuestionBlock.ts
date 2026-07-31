import type { jsPDF } from "jspdf";
import { getSectionMessageParts, type PdfSectionMessageKey } from "./pdfSectionMessages";
import { ensureSpace, getContentWidth, PDF_LINE_HEIGHT, PDF_PAGE_MARGIN } from "./pdfLayout";
import { PDF_OPTION_LABELS } from "./pdfConstants";
import { renderPdfTextBlock, setPdfLatinFont, wrapLatinText } from "./renderPdfText";
import { renderPdfRichHtml } from "./renderPdfRichHtml";

type RenderableQuestion = StudentExamStandardQuestion | StudentExamPassageChildQuestion;

const renderBlankAnswerSpace = (doc: jsPDF, y: number, lines = 3): number => {
  let cursorY = y;
  for (let i = 0; i < lines; i += 1) {
    cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT + 2);
    doc.setDrawColor(180, 180, 180);
    doc.line(PDF_PAGE_MARGIN + 8, cursorY, PDF_PAGE_MARGIN + getContentWidth(doc) - 8, cursorY);
    cursorY += PDF_LINE_HEIGHT + 2;
  }
  return cursorY;
};

export const renderSectionMessage = async (
  doc: jsPDF,
  y: number,
  messageKey: PdfSectionMessageKey,
  subject: StudentExamSubject,
): Promise<number> => {
  const contentWidth = getContentWidth(doc);
  const { bengali, english } = getSectionMessageParts(messageKey, subject);
  let cursorY = ensureSpace(doc, y, PDF_LINE_HEIGHT * 3);

  doc.setFontSize(10);

  if (bengali) {
    const combinedMessage = `${bengali} ${english}`;
    cursorY = await renderPdfTextBlock(doc, combinedMessage, PDF_PAGE_MARGIN, cursorY, contentWidth, PDF_LINE_HEIGHT, {
      fontSize: 10,
      style: "normal",
    });
    cursorY += 8;
    return cursorY;
  }

  setPdfLatinFont(doc, "italic");
  const englishLines = wrapLatinText(doc, english, contentWidth);
  doc.text(englishLines, PDF_PAGE_MARGIN, cursorY);
  cursorY += englishLines.length * PDF_LINE_HEIGHT + 6;

  return cursorY;
};

export const renderQuestionBlock = async (
  doc: jsPDF,
  questionNumber: number,
  question: RenderableQuestion,
  y: number,
): Promise<number> => {
  const contentWidth = getContentWidth(doc);
  let cursorY = y;
  const subType = question.subType ?? "multiple-choice";

  if (question.instruction) {
    cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 2);
    doc.setFontSize(10);
    cursorY = await renderPdfRichHtml(
      doc,
      question.instruction,
      PDF_PAGE_MARGIN,
      cursorY,
      contentWidth,
      PDF_LINE_HEIGHT,
      {
        fontSize: 10,
        style: "normal",
      },
    );
    cursorY += 2;
  }

  cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 2);
  doc.setFontSize(11);
  cursorY = await renderPdfRichHtml(doc, question.text, PDF_PAGE_MARGIN, cursorY, contentWidth, PDF_LINE_HEIGHT + 1, {
    fontSize: 11,
    style: "bold",
    prefix: `${questionNumber}. `,
  });
  cursorY += 3;

  if (subType === "essay" || subType === "fill-in-the-gaps") {
    cursorY = renderBlankAnswerSpace(doc, cursorY, subType === "essay" ? 5 : 2);
    return cursorY + 4;
  }

  if (subType === "fill-in-the-blanks" || subType === "answer-box") {
    cursorY = renderBlankAnswerSpace(doc, cursorY, subType === "answer-box" ? 3 : 1);
    return cursorY + 4;
  }

  if (question.options?.length && subType !== "matching-ordering") {
    doc.setFontSize(10);
    for (const [index, option] of question.options.entries()) {
      const label = PDF_OPTION_LABELS[index] ?? String(index + 1);
      cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 2);
      cursorY = await renderPdfRichHtml(
        doc,
        option.text,
        PDF_PAGE_MARGIN + 8,
        cursorY,
        contentWidth - 10,
        PDF_LINE_HEIGHT,
        {
          fontSize: 10,
          prefix: `${label}. `,
        },
      );
      cursorY += 1;
    }
  }

  if (question.matchingOptions) {
    doc.setFontSize(10);
    setPdfLatinFont(doc, "bold");
    cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 2);
    doc.text("Left", PDF_PAGE_MARGIN + 8, cursorY);
    doc.text("Right", PDF_PAGE_MARGIN + contentWidth / 2, cursorY);
    cursorY += PDF_LINE_HEIGHT + 2;

    const leftItems = question.matchingOptions.left;
    const rightItems = question.matchingOptions.right;
    const rowCount = Math.max(leftItems.length, rightItems.length);
    const columnWidth = contentWidth / 2 - 12;

    for (let i = 0; i < rowCount; i += 1) {
      const leftText = leftItems[i]?.text ?? "";
      const rightText = rightItems[i]?.text ?? "";

      cursorY = ensureSpace(doc, cursorY, PDF_LINE_HEIGHT * 3);
      const leftEndY = await renderPdfRichHtml(
        doc,
        leftText,
        PDF_PAGE_MARGIN + 8,
        cursorY,
        columnWidth,
        PDF_LINE_HEIGHT,
        { prefix: `${i + 1}. ` },
      );
      const rightEndY = await renderPdfRichHtml(
        doc,
        rightText,
        PDF_PAGE_MARGIN + contentWidth / 2,
        cursorY,
        columnWidth,
        PDF_LINE_HEIGHT,
        { prefix: `${i + 1}. ` },
      );
      cursorY = Math.max(leftEndY, rightEndY) + 1;
    }
  }

  return cursorY + 6;
};

export const renderPassageBlock = async (
  doc: jsPDF,
  passage: StudentExamPassageQuestion,
  y: number,
  renderChild: (
    question: StudentExamPassageChildQuestion,
    questionNumber: number,
    startY: number,
  ) => Promise<number>,
  startQuestionNumber: number,
): Promise<{ y: number; nextQuestionNumber: number }> => {
  const contentWidth = getContentWidth(doc);
  let cursorY = y;

  doc.setFontSize(10);
  cursorY = await renderPdfRichHtml(doc, passage.passageText, PDF_PAGE_MARGIN, cursorY, contentWidth, PDF_LINE_HEIGHT, {
    fontSize: 10,
  });
  cursorY += 6;

  let questionNumber = startQuestionNumber;
  for (const child of passage.childQuestions) {
    cursorY = await renderChild(child, questionNumber, cursorY);
    questionNumber += 1;
  }

  return { y: cursorY + 4, nextQuestionNumber: questionNumber };
};
