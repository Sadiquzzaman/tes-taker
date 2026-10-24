"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import ShareLinkDialog from "@/component/Share/ShareLinkDialog";
import useFormat from "@/i18n/useFormat";
import { buildTestJoinLink } from "@/utils/frontendAppUrl";
import { getTeacherShareMeta } from "@/utils/tests/testListItem";

/** Share a test's link (after creating or scheduling it, and from a test card). */
const ShareTestModal = ({ open, setOpen, testData }: ShareTestModalProps) => {
  const t = useTranslations("tests.share");
  const format = useFormat();
  const { publishTiming, scheduledAt, testAudience, className, excludedStudentsCount } = getTeacherShareMeta(testData.test);
  const link = useMemo(() => (testData.test.id ? buildTestJoinLink(testData.test.id) : ""), [testData.test.id]);
  const name = testData.test.test_name;
  const scheduled = publishTiming === "later" && scheduledAt;

  return (
    <ShareLinkDialog
      open={open}
      onClose={setOpen}
      title={testData.type === "new" ? (scheduled ? t("scheduled") : t("created")) : t("title")}
      description={
        scheduled ? t("scheduledFor", { date: format.dateTime(scheduledAt) }) : testData.type === "new" ? t("createdDetail", { name }) : t("shareDetail", { name })
      }
      notes={
        <>
          {testAudience === "anyone" ? <p>{t("anyone")}</p> : null}
          {testAudience === "selected_class" ? <p>{t("classOnly", { className })}</p> : null}
          {testAudience === "selected_class" && excludedStudentsCount > 0 ? <p>{t("excluded", { count: excludedStudentsCount })}</p> : null}
        </>
      }
      linkLabel={t("link")}
      link={link}
      message={t("message", { link })}
      emailSubject={t("subject", { name })}
    />
  );
};

export default ShareTestModal;
