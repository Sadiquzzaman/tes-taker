import { memo } from "react";
import { useTranslations } from "next-intl";

function QuestionCardMatchingHint() {
  const t = useTranslations("createTest.card");
  return (
    <p className="text-body-sm text-warning">
      {t("matchingHint")}
    </p>
  );
}

export default memo(QuestionCardMatchingHint);
