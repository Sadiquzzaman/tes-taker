"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn, FilterBar, focusRing, Modal } from "@/design/ui";

/** Pick a subject from the catalogue to add to a model test. */
const AddQuestionSubjectModal = ({ open, onClose, onSelect, subjectOptions }: AddQuestionSubjectModalProps) => {
  const t = useTranslations("createTest.subjects");
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase();
  const visible = (needle ? subjectOptions.filter((subject) => subject.label.toLocaleLowerCase().includes(needle)) : subjectOptions).slice(0, 10);

  const close = () => {
    setSearch("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} size="sm" title={t("addTitle")} description={t("addIntro")}>
      <div className="flex flex-col gap-3">
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t("search")} />
        <ul className="max-h-72 overflow-y-auto rounded-input border border-border p-1">
          {visible.length ? (
            visible.map((subject) => (
              <li key={subject.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(subject);
                    setSearch("");
                  }}
                  className={cn("w-full rounded-input px-3 py-2 text-left text-body-sm font-medium text-ink hover:bg-primary-soft", focusRing)}
                >
                  {subject.label}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-6 text-center text-body-sm text-ink-muted">{t("none")}</li>
          )}
        </ul>
      </div>
    </Modal>
  );
};

export default AddQuestionSubjectModal;
