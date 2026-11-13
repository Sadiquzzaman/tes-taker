"use client";

import { useTranslations } from "next-intl";
import useApiData from "@/component/Homework/useApiData";
import { Button, EmptyState, ErrorState, Skeleton } from "@/design/ui";
import ReportCardSheet from "./ReportCardSheet";

/** A4 portrait, one card per page; the toolbar is not printed. */
const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  .report-cards-toolbar { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

/**
 * Report cards ready to print (PRF-09): one card (`id`) or the latest cards of a section for a
 * term, one per page, in the card's language. "Print / Save as PDF" uses the browser's print, so
 * a whole section is one PDF and Bangla letters are shaped by the browser's fonts.
 */
const ReportCardsPrint = ({ id, sectionId, termId }: { id?: string; sectionId?: string; termId?: string }) =>
  id ? <OneCard id={id} /> : <SectionCards sectionId={sectionId ?? ""} termId={termId} />;

const OneCard = ({ id }: { id: string }) => {
  const { data, failed, reload } = useApiData<ReportCardView>(`/report-cards/${id}`);
  return <Sheets cards={data ? [data] : null} failed={failed} reload={reload} />;
};

const SectionCards = ({ sectionId, termId }: { sectionId: string; termId?: string }) => {
  const { data, failed, reload } = useApiData<ReportCardView[]>("/report-cards/print", { section_id: sectionId, term_id: termId || undefined });
  return <Sheets cards={data} failed={failed} reload={reload} />;
};

const Sheets = ({ cards, failed, reload }: { cards: ReportCardView[] | null; failed: number | null; reload: () => void }) => {
  const t = useTranslations("reportCard");
  return (
    <main className="min-h-screen bg-canvas py-6 print:bg-surface print:py-0">
      <style>{PRINT_CSS}</style>
      <div className="report-cards-toolbar mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 px-4">
        <p className="text-body-sm text-ink-muted">{cards ? t("count", { count: cards.length }) : null}</p>
        <Button onClick={() => window.print()} disabled={!cards?.length}>
          {t("print")}
        </Button>
      </div>
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : !cards ? (
        <div className="mx-auto max-w-3xl px-4" aria-busy="true">
          <Skeleton lines={10} />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState title={t("none")} description={t("noneHint")} />
      ) : (
        <div className="flex flex-col gap-6 print:gap-0">
          {cards.map((card) => (
            <ReportCardSheet key={card.id} card={card} />
          ))}
        </div>
      )}
    </main>
  );
};

export default ReportCardsPrint;
