import { jsPDF } from "jspdf";
import { loadPdfAssets } from "./pdf/loadPdfAssets";
import { addWatermark, PDF_PAGE_MARGIN } from "./pdf/pdfLayout";
import { renderGradingResultsTable } from "./pdf/renderGradingResultsTable";
import { renderResultsPdfHeader } from "./pdf/renderResultsPdfHeader";
import { setPdfLatinFont } from "./pdf/renderPdfText";

export interface DownloadExamResultsPdfOptions {
  testName: string;
  className: string | null;
  subject: string | null;
  submissions: GradingSubmissionListItem[];
}

export const downloadExamResultsPdf = async (options: DownloadExamResultsPdfOptions): Promise<void> => {
  const assets = await loadPdfAssets();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  setPdfLatinFont(doc, "normal");

  let y = PDF_PAGE_MARGIN;
  y = await renderResultsPdfHeader(doc, y, {
    className: options.className,
    subject: options.subject,
    logoBase64: assets.logoBase64,
  });

  y = await renderGradingResultsTable(doc, y, options.submissions);

  addWatermark(doc);
  const safeName = (options.testName || "exam-results").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  doc.save(`${safeName}-results.pdf`);
};
