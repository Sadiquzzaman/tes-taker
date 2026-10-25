import { getTranslations } from "next-intl/server";
import PaymentResult, { PaymentReference } from "@/component/Payment/PaymentResult";

export default async function PaymentFailPage({ searchParams }: { searchParams: Promise<{ tran_id?: string }> }) {
  const { tran_id } = await searchParams;
  const t = await getTranslations("payment");

  return (
    <PaymentResult tone="danger" title={t("failed.title")} detail={t("failed.detail")} action={{ href: "/account", label: t("backToBilling") }}>
      {tran_id ? <PaymentReference label={t("reference")} value={tran_id} /> : null}
    </PaymentResult>
  );
}
