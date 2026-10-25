"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import PublishCopyIconSVG from "@/component/svg/PublishCopyIconSVG";
import { Button, Card, cn, focusRing, Select, TagInput } from "@/design/ui";
import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { addExcludedStudent, removeExcludedStudent, setPublishField, setPublishTiming, setTestAudience } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { buildTestJoinLink, getFrontendAppUrl } from "@/utils/frontendAppUrl";
import PublishSchedule from "./PublishSchedule";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS = /^\d+$/;

/** Step 5: when the test opens, who can take it, and its join link. */
const PublishStep = () => {
  const t = useTranslations("createTest.publish");
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const { publishState, editExamId, formState } = useAppSelector((state) => state.createTest as CreateTestState);
  const isIelts = (formState.examCategory ?? "academic") === "ielts";
  const { classList } = useGetAllClass();
  const { isIndividual } = useWorkspace();
  const selectedClass = classList.find((item) => item.id === publishState.selectedClassId);
  const [studentInput, setStudentInput] = useState("");
  const [copied, setCopied] = useState(false);

  const joinLink = useMemo(
    () => (editExamId ? buildTestJoinLink(editExamId) : `${getFrontendAppUrl()}/join/test/…`),
    [editExamId],
  );

  const handleCopy = useCallback(() => {
    if (!editExamId) {
      triggerToast({ title: t("linkUnavailableTitle"), description: t("linkUnavailable"), type: "info" });
      return;
    }
    void navigator.clipboard.writeText(joinLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [editExamId, joinLink, t, triggerToast]);

  const handleAddStudent = useCallback(() => {
    const value = studentInput.trim();
    if (!value) return;
    if (!EMAIL.test(value) && !DIGITS.test(value)) {
      triggerToast({ title: t("invalidTitle"), description: t("invalid"), type: "error" });
    } else if (DIGITS.test(value) && value.length !== 11) {
      triggerToast({ title: t("invalidPhoneTitle"), description: t("invalidPhone"), type: "error" });
    } else {
      dispatch(addExcludedStudent(value));
      setStudentInput("");
    }
  }, [dispatch, studentInput, t, triggerToast]);

  const timingOption = (timing: PublishTiming, title: string, detail: string) => {
    const selected = publishState.publishTiming === timing;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => dispatch(setPublishTiming(timing))}
        className={cn(
          "flex flex-1 items-start gap-3 rounded-card border p-4 text-left transition-colors",
          selected ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-ink-muted",
          focusRing,
        )}
      >
        <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary" : "border-ink-muted")}>
          {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-body font-medium text-ink">{title}</span>
          <span className="text-body-sm text-ink-muted">{detail}</span>
        </span>
      </button>
    );
  };

  const showClassPicker = isIndividual ? publishState.testAudience === "selected_class" : true;

  return (
    <section className="flex w-full flex-1 flex-col gap-6">
      <Card title={t("timing")}>
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label={t("timing")} className="flex flex-col gap-3 sm:flex-row">
            {timingOption("immediately", t("now"), t("nowDetail"))}
            {timingOption("later", t("later"), t("laterDetail"))}
          </div>
          {publishState.publishTiming === "later" ? <PublishSchedule /> : null}
        </div>
      </Card>

      <Card title={t("audience")}>
        <div className="flex flex-col gap-4">
          {isIndividual ? (
            <Select
              label={t("audienceLabel")}
              placeholder={false}
              value={publishState.testAudience}
              onChange={(event) => dispatch(setTestAudience(event.target.value as TestAudience))}
              options={[
                { value: "anyone", label: t("anyone") },
                { value: "selected_class", label: t("classAudience") },
              ]}
            />
          ) : null}

          {showClassPicker ? (
            <div className="flex flex-col gap-3">
              {isIndividual ? (
                <Select
                  label={isIelts ? t("batch") : t("class")}
                  placeholder={isIelts ? t("selectBatch") : t("selectClass")}
                  value={publishState.selectedClassId}
                  onChange={(event) => dispatch(setPublishField({ field: "selectedClassId", value: event.target.value }))}
                  options={classList.map((item) => ({ label: item.class_name, value: item.id }))}
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-body-sm font-medium text-ink">{isIelts ? t("batch") : t("class")}</p>
                  <p className="rounded-input bg-canvas px-3 py-2.5 text-body text-ink">{selectedClass?.class_name || t("fromBasicInfo")}</p>
                </div>
              )}
              {publishState.selectedClassId ? (
                <>
                  <p className="text-body-sm text-ink-muted">{isIelts ? t("batchStudents") : t("classStudents")}</p>
                  <div className="flex items-end gap-2">
                    <TagInput
                      className="flex-1"
                      label={t("exclude")}
                      hint={t("excludeHint")}
                      placeholder={t("excludePlaceholder")}
                      value={studentInput}
                      onChange={setStudentInput}
                      tags={publishState.excluded_students}
                      onAdd={handleAddStudent}
                      onRemove={(index) => dispatch(removeExcludedStudent(index))}
                    />
                  </div>
                  <Button variant="secondary" size="sm" className="self-start" disabled={!studentInput.trim()} onClick={handleAddStudent}>
                    {t("add")}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {isIndividual && publishState.testAudience === "anyone" ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm font-medium text-ink">{t("link")}</p>
              <div className="flex items-center gap-2 rounded-input bg-canvas py-1.5 pl-3 pr-1.5">
                <span className="min-w-0 flex-1 truncate text-body-sm text-info">{joinLink}</span>
                <Button size="sm" leftIcon={<PublishCopyIconSVG width={14} />} disabled={!editExamId} onClick={handleCopy}>
                  {copied ? t("copied") : t("copy")}
                </Button>
              </div>
              <p className="text-body-sm text-ink-muted">{editExamId ? t("linkNow") : t("linkLater")}</p>
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
};

export default PublishStep;
