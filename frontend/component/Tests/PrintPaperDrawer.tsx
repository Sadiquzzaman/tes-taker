"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Checkbox, Drawer, RadioGroup } from "@/design/ui";
import { downloadAnswerKeyPdf, downloadExamQuestionsPdf } from "@/utils/exam/downloadExamQuestionsPdf";
import { answerKey, PAPER_SETS, paperSet, type PaperSet } from "@/utils/exam/paperSets";

/**
 * Print-ready papers (P8-05, QA-05): one set (A keeps the order; B and C shuffle questions and
 * options), on A4 or Legal, with the school's name on top, and the set's answer key as a separate
 * PDF. Built in the browser with the paper's fonts, as the existing question download.
 */
const PrintPaperDrawer = ({
  open,
  onClose,
  exam,
  organizationName,
}: {
  open: boolean;
  onClose: () => void;
  exam: { id: string; test_name: string; class_name: string | null; formState?: { duration?: number | string }; subjects: StudentExamSubject[] };
  organizationName?: string | null;
}) => {
  const t = useTranslations("tests.print");
  const { triggerToast } = useToast();
  const [set, setSet] = useState<PaperSet>("A");
  const [paper, setPaper] = useState<"a4" | "legal">("a4");
  const [withKey, setWithKey] = useState(true);
  const [busy, setBusy] = useState(false);
  const hasQuestions = exam.subjects.some((subject) => subject.questions.length > 0);

  const print = async () => {
    setBusy(true);
    try {
      const subjects = paperSet(exam.subjects, exam.id, set);
      await downloadExamQuestionsPdf({
        testName: exam.test_name,
        className: exam.class_name,
        durationMinutes: Number(exam.formState?.duration ?? 0),
        subjects,
        paper,
        setLabel: set,
        organizationName,
      });
      if (withKey) {
        await downloadAnswerKeyPdf({ testName: exam.test_name, organizationName, setLabel: set, paper, key: answerKey(subjects, exam.subjects) });
      }
      onClose();
    } catch {
      triggerToast({ title: t("failed"), type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("title")}
      description={t("description")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} disabled={!hasQuestions} onClick={() => void print()}>
            {t("download")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!hasQuestions ? <p className="text-body-sm text-ink-muted">{t("noQuestions")}</p> : null}
        <RadioGroup
          legend={t("set")}
          name="paper-set"
          inline
          value={set}
          onChange={(value) => setSet(value as PaperSet)}
          options={PAPER_SETS.map((value) => ({ value, label: t("setLabel", { set: value }), hint: value === "A" ? t("setAHint") : t("setShuffledHint") }))}
        />
        <RadioGroup
          legend={t("paper")}
          name="paper-size"
          inline
          value={paper}
          onChange={(value) => setPaper(value as "a4" | "legal")}
          options={[
            { value: "a4", label: t("a4") },
            { value: "legal", label: t("legal") },
          ]}
        />
        <Checkbox label={t("answerKey")} hint={t("answerKeyHint")} checked={withKey} onChange={(event) => setWithKey(event.target.checked)} />
      </div>
    </Drawer>
  );
};

export default PrintPaperDrawer;
