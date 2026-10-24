"use client";

import { useTranslations } from "next-intl";
import ShareLinkDialog from "@/component/Share/ShareLinkDialog";
import useShareClass from "@/hooks/classes/useShareClass";

/** Share a class's join link (shown after creating a class, and from Share class). */
const ShareClassModal = () => {
  const t = useTranslations("classes.shareModal");
  const { classData, open, classLink, handleClose } = useShareClass();
  const isNew = classData?.type === "new";
  const name = classData?.class_name ?? "";

  return (
    <ShareLinkDialog
      open={open}
      onClose={handleClose}
      title={isNew ? t("created") : t("title")}
      description={isNew ? t("createdDetail", { name, count: classData?.classStudents?.length ?? 0 }) : t("shareDetail", { name })}
      notes={<p>{t("anyone")}</p>}
      linkLabel={t("link")}
      link={classLink}
      message={t("message", { link: classLink })}
      emailSubject={t("subject")}
    />
  );
};

export default ShareClassModal;
