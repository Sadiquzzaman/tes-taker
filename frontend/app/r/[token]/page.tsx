import { getTranslations } from "next-intl/server";
import CardLocaleProvider from "@/component/ReportCards/CardLocaleProvider";
import { Sheets } from "@/component/ReportCards/ReportCardsPrint";

/**
 * A report card shared with guardians by SMS (PRF-09): the link needs no login and works for 30
 * days. The card is read on the server and shown in its own language, ready to print.
 */
export default async function SharedReportCardRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/public/report-cards/${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
  const card = response?.ok ? ((await response.json()) as { payload: ReportCardView }).payload : null;
  if (!card) {
    const t = await getTranslations("sharedCard");
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="max-w-md rounded-card border border-border bg-surface p-6 text-center shadow-card">
          <h1 className="text-title-sm font-semibold text-ink">{t("expiredTitle")}</h1>
          <p className="mt-2 text-body-sm text-ink-muted">{t("expiredDetail")}</p>
        </div>
      </main>
    );
  }
  return (
    <CardLocaleProvider locale={card.locale}>
      <Sheets cards={[card]} />
    </CardLocaleProvider>
  );
}
