import type { jsPDF } from "jspdf";
import { ensureSpace, getContentWidth, PDF_LINE_HEIGHT, PDF_PAGE_MARGIN } from "./pdfLayout";
import { renderPdfTextBlock, setPdfLatinFont } from "./renderPdfText";

const TABLE_ROW_MIN_HEIGHT = 8;
const TABLE_HEADER_HEIGHT = 10;

const TABLE_COLUMNS = {
  serial: { label: "SL", widthRatio: 0.08 },
  name: { label: "Student Name", widthRatio: 0.42 },
  phone: { label: "Phone Number", widthRatio: 0.28 },
  marks: { label: "Marks Obtained", widthRatio: 0.22 },
} as const;

const getColumnLayout = (contentWidth: number) => {
  const serialWidth = contentWidth * TABLE_COLUMNS.serial.widthRatio;
  const nameWidth = contentWidth * TABLE_COLUMNS.name.widthRatio;
  const phoneWidth = contentWidth * TABLE_COLUMNS.phone.widthRatio;
  const marksWidth = contentWidth * TABLE_COLUMNS.marks.widthRatio;

  const serialX = PDF_PAGE_MARGIN;
  const nameX = serialX + serialWidth;
  const phoneX = nameX + nameWidth;
  const marksX = phoneX + phoneWidth;

  return {
    serial: { x: serialX, width: serialWidth },
    name: { x: nameX, width: nameWidth },
    phone: { x: phoneX, width: phoneWidth },
    marks: { x: marksX, width: marksWidth },
  };
};

const drawTableBorder = (doc: jsPDF, y: number, height: number, contentWidth: number): void => {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(PDF_PAGE_MARGIN, y, contentWidth, height);
};

const formatMarks = (submission: GradingSubmissionListItem): string => {
  if (submission.total_score === null || submission.total_score === undefined) {
    return "-";
  }

  return String(submission.total_score);
};

const formatPhone = (submission: GradingSubmissionListItem): string => {
  return submission.phone?.trim() || "-";
};

const renderLatinCell = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "center" | "right" = "left",
): number => {
  setPdfLatinFont(doc, "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, width - 4) as string[];
  const textY = y + 5;

  if (align === "center") {
    doc.text(lines, x + width / 2, textY, { align: "center", maxWidth: width - 4 });
  } else if (align === "right") {
    doc.text(lines, x + width - 2, textY, { align: "right", maxWidth: width - 4 });
  } else {
    doc.text(lines, x + 2, textY, { maxWidth: width - 4 });
  }

  return lines.length * PDF_LINE_HEIGHT + 4;
};

const renderTableHeader = (doc: jsPDF, y: number, contentWidth: number): number => {
  const columns = getColumnLayout(contentWidth);
  let cursorY = ensureSpace(doc, y, TABLE_HEADER_HEIGHT);

  setPdfLatinFont(doc, "bold");
  doc.setFontSize(10);
  doc.text(TABLE_COLUMNS.serial.label, columns.serial.x + 2, cursorY + 6);
  doc.text(TABLE_COLUMNS.name.label, columns.name.x + 2, cursorY + 6);
  doc.text(TABLE_COLUMNS.phone.label, columns.phone.x + 2, cursorY + 6);
  doc.text(TABLE_COLUMNS.marks.label, columns.marks.x + columns.marks.width / 2, cursorY + 6, {
    align: "center",
  });

  drawTableBorder(doc, cursorY, TABLE_HEADER_HEIGHT, contentWidth);
  cursorY += TABLE_HEADER_HEIGHT;

  doc.setDrawColor(180, 180, 180);
  doc.line(columns.name.x, cursorY - TABLE_HEADER_HEIGHT, columns.name.x, cursorY);
  doc.line(columns.phone.x, cursorY - TABLE_HEADER_HEIGHT, columns.phone.x, cursorY);
  doc.line(columns.marks.x, cursorY - TABLE_HEADER_HEIGHT, columns.marks.x, cursorY);

  return cursorY;
};

const renderTableRow = async (
  doc: jsPDF,
  y: number,
  serial: number,
  submission: GradingSubmissionListItem,
  contentWidth: number,
): Promise<number> => {
  const columns = getColumnLayout(contentWidth);
  let cursorY = ensureSpace(doc, y, TABLE_ROW_MIN_HEIGHT);
  const rowTop = cursorY;

  const serialHeight = renderLatinCell(doc, String(serial), columns.serial.x, rowTop, columns.serial.width, "center");
  const phoneHeight = renderLatinCell(
    doc,
    formatPhone(submission),
    columns.phone.x,
    rowTop,
    columns.phone.width,
  );
  const marksHeight = renderLatinCell(
    doc,
    formatMarks(submission),
    columns.marks.x,
    rowTop,
    columns.marks.width,
    "center",
  );

  const nameText = submission.student_name?.trim() || "Anonymous";
  const nameEndY = await renderPdfTextBlock(
    doc,
    nameText,
    columns.name.x + 2,
    rowTop + 4,
    columns.name.width - 4,
    PDF_LINE_HEIGHT,
    { fontSize: 10 },
  );
  const nameHeight = nameEndY - rowTop;

  const rowHeight = Math.max(TABLE_ROW_MIN_HEIGHT, serialHeight, phoneHeight, marksHeight, nameHeight);
  drawTableBorder(doc, rowTop, rowHeight, contentWidth);

  doc.setDrawColor(180, 180, 180);
  doc.line(columns.name.x, rowTop, columns.name.x, rowTop + rowHeight);
  doc.line(columns.phone.x, rowTop, columns.phone.x, rowTop + rowHeight);
  doc.line(columns.marks.x, rowTop, columns.marks.x, rowTop + rowHeight);

  return rowTop + rowHeight;
};

export const renderGradingResultsTable = async (
  doc: jsPDF,
  y: number,
  submissions: GradingSubmissionListItem[],
): Promise<number> => {
  const contentWidth = getContentWidth(doc);
  let cursorY = renderTableHeader(doc, y, contentWidth);

  const sortedSubmissions = [...submissions].sort((left, right) => {
    const leftName = (left.student_name ?? "").trim().toLowerCase();
    const rightName = (right.student_name ?? "").trim().toLowerCase();
    return leftName.localeCompare(rightName);
  });

  for (const [index, submission] of sortedSubmissions.entries()) {
    cursorY = await renderTableRow(doc, cursorY, index + 1, submission, contentWidth);
  }

  return cursorY + 4;
};
