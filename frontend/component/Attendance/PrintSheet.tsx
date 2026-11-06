"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const PRINT_ROOT_ID = "attendance-print";

/**
 * Print rules for the reports (ATT-13): A4 landscape, only the print sheet on paper (the app's menus
 * and buttons are hidden), each table's header row repeated on every page, rows never split, and
 * each section on the daily summary kept on one page where it fits. The browser's own "Save as
 * PDF" writes the PDF, so Bangla letters are shaped by the browser's fonts.
 */
const PRINT_CSS = `
#${PRINT_ROOT_ID} { display: none; }
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
  #${PRINT_ROOT_ID} { display: block; color: var(--color-ink); background: var(--color-surface); }
  #${PRINT_ROOT_ID} table { width: 100%; border-collapse: collapse; }
  #${PRINT_ROOT_ID} thead { display: table-header-group; }
  #${PRINT_ROOT_ID} tr { break-inside: avoid; }
  #${PRINT_ROOT_ID} th, #${PRINT_ROOT_ID} td { border: 1px solid var(--color-border); padding: 1px 3px; }
  #${PRINT_ROOT_ID} .print-block { break-inside: avoid-page; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

const subscribe = () => () => undefined;

export interface PrintSheetProps {
  /** The organisation (or workspace) name, first line of the header. */
  organization?: string | null;
  title: string;
  /** Section, month or date range. */
  subtitle?: string;
  /** The letter legend, printed under the header. */
  legend?: ReactNode;
  children: ReactNode;
}

/**
 * The paper version of a report: rendered straight under `<body>` and shown only when printing
 * ("Print / Save as PDF" calls the browser's print). On screen it takes no space.
 */
const PrintSheet = ({ organization, title, subtitle, legend, children }: PrintSheetProps) => {
  // Only in the browser (the portal needs document.body).
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div id={PRINT_ROOT_ID} data-testid="print-sheet" className="text-caption">
      <style>{PRINT_CSS}</style>
      <header className="mb-2">
        {organization ? <p className="font-semibold">{organization}</p> : null}
        <h1 className="text-body font-semibold">{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {legend ? <div className="mt-1">{legend}</div> : null}
      </header>
      {children}
    </div>,
    document.body,
  );
};

export default PrintSheet;
