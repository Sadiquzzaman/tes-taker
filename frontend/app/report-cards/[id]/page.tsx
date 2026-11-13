import CardLocaleProvider from "@/component/ReportCards/CardLocaleProvider";
import ReportCardsPrint from "@/component/ReportCards/ReportCardsPrint";

/** One report card, ready to print, in its language (PRF-09). */
export default async function ReportCardRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ locale?: string }> }) {
  const [{ id }, { locale }] = await Promise.all([params, searchParams]);
  return (
    <CardLocaleProvider locale={locale}>
      <ReportCardsPrint id={id} />
    </CardLocaleProvider>
  );
}
