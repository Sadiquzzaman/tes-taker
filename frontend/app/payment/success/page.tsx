import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import PaymentResult from "@/component/Payment/PaymentResult";
import PaymentSuccessContent from "@/component/Payment/PaymentSuccessContent";

export default async function PaymentSuccessPage() {
  const t = await getTranslations("payment");
  return (
    <Suspense
      fallback={<PaymentResult tone="busy" title={t("checking.title")} detail={t("checking.detail")} action={{ href: "/account", label: t("goToAccount") }} />}
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
