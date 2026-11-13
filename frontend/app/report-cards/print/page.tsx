import CardLocaleProvider from "@/component/ReportCards/CardLocaleProvider";
import ReportCardsPrint from "@/component/ReportCards/ReportCardsPrint";

/** A section's report cards for a term, ready to print as one PDF, in the chosen language (PRF-09). */
export default async function ReportCardsPrintRoute({ searchParams }: { searchParams: Promise<{ section_id?: string; term_id?: string; locale?: string }> }) {
  const { section_id, term_id, locale } = await searchParams;
  return (
    <CardLocaleProvider locale={locale}>
      <ReportCardsPrint sectionId={section_id} termId={term_id} />
    </CardLocaleProvider>
  );
}
