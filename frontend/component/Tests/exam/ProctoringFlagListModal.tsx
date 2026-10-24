"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import { useAppSelector } from "@/lib/hooks";
import { useTranslations } from "next-intl";
import { useState } from "react";

const ProctoringFlagListModal = () => {
  const flags = useAppSelector((state) => state.proctoring.flags);
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("proctoring.flagList");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(flags, null, 2));
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-input border border-border px-3 py-2 text-left text-caption font-medium leading-4 text-ink"
      >
        {t("open")}
      </button>

      <CreateModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidthClassName="max-w-[520px]"
        panelClassName="p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-title-sm font-semibold leading-6 text-ink">{t("title")}</p>
              <p className="text-body-sm leading-5 text-ink-muted">{t("devNote")}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded-input border border-border px-3 py-2 text-caption font-medium leading-4 text-ink"
              >
                {copied ? t("copied") : t("copy")}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-input border border-border px-3 py-2 text-caption font-medium leading-4 text-ink"
              >
                {t("close")}
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-card border border-border">
            <table className="w-full border-collapse">
              <thead className="bg-primary-soft">
                <tr>
                  <th className="px-4 py-3 text-left text-caption font-semibold leading-4 text-primary">{t("type")}</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold leading-4 text-primary">{t("penalty")}</th>
                </tr>
              </thead>

              <tbody>
                {flags.length > 0 ? (
                  flags.map((flag) => (
                    <tr key={flag.id} className="border-t border-border">
                      <td className="px-4 py-3 text-body-sm leading-5 text-ink">{flag.type}</td>
                      <td className="px-4 py-3 text-body-sm font-semibold leading-5 text-ink">{flag.points}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-body-sm leading-5 text-ink-muted">
                      {t("empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CreateModal>
    </>
  );
};

export default ProctoringFlagListModal;
