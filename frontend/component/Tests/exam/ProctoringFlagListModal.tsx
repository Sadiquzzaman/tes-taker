"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Modal, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { useAppSelector } from "@/lib/hooks";

/** Development aid: every proctoring flag recorded in this session, copyable as JSON. */
const ProctoringFlagListModal = () => {
  const t = useTranslations("proctoring.flagList");
  const format = useFormat();
  const flags = useAppSelector((state) => state.proctoring.flags);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(flags, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const columns: TableColumn<ProctoringFlag>[] = [
    { key: "type", header: t("type"), cell: (row) => row.type },
    { key: "points", header: t("penalty"), cell: (row) => format.number(row.points), align: "right" },
  ];

  return (
    <>
      <Button variant="secondary" size="sm" fullWidth onClick={() => setIsOpen(true)}>
        {t("open")}
      </Button>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("title")}
        description={t("devNote")}
        footer={
          <Button variant="secondary" onClick={() => void handleCopy()}>
            {copied ? t("copied") : t("copy")}
          </Button>
        }
      >
        <Table caption={t("title")} columns={columns} rows={flags} getRowId={(row) => row.id} empty={<p className="p-4 text-center text-body-sm text-ink-muted">{t("empty")}</p>} />
      </Modal>
    </>
  );
};

export default ProctoringFlagListModal;
