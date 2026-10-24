import { addSubject, removeSubject, setFormField, setPublishField, setSingleSubject, setTestAudience } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import Tooltip from "@/Ui/Tooltip";
import useGetAllSubject from "@/hooks/api/subject/useGetAllSubject";
import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import useWorkspace from "@/hooks/organization/useWorkspace";
import { getStoredUser } from "@/lib/authSession";
import axiosReq from "@/lib/axios";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, Checkbox, Combobox, Input, RadioGroup } from "@/design/ui";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { EXAM_CATEGORIES, IELTS_MODULES } from "@/constants/examCategory";

const assignedSubjectLabel = (subject: AssignedClassSubject) =>
  subject.code?.trim() ? `${subject.name} (${subject.code.trim()})` : subject.name;

const toSubjectOption = (subject: AssignedClassSubject) => ({
  id: subject.subject_id,
  label: assignedSubjectLabel(subject),
  value: subject.code?.trim() || subject.name,
});

/** Step 1: the test's name, class, type, subject(s), duration and marking rules. */
const BasicInfoStep = memo(({ formState }: BasicInfoStepProps) => {
  const t = useTranslations("createTest.basic");
  const tc = useTranslations("createTest");
  const dispatch = useAppDispatch();
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const subjectCatalog = useAppSelector((state) => state.subject.subjects);
  const { subjects, activeSubjectId, publishState } = createTestState;
  const { hasFeature } = useEntitlements();
  const canCreateModelTests = hasFeature("allow_model_tests");
  const { isIndividual } = useWorkspace();
  const { classList } = useGetAllClass();
  const [assignedSubjects, setAssignedSubjects] = useState<AssignedClassSubject[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  useGetAllSubject();

  const updateField = useCallback(
    (field: keyof FormState, value: FormState[keyof FormState]) => {
      dispatch(setFormField({ field, value }));
    },
    [dispatch],
  );

  useEffect(() => {
    if (!canCreateModelTests && formState.isModelTest) {
      dispatch(setFormField({ field: "isModelTest", value: false }));
    }
  }, [canCreateModelTests, dispatch, formState.isModelTest]);

  useEffect(() => {
    if (isIndividual) {
      return;
    }
    if (publishState.testAudience !== "selected_class") {
      dispatch(setTestAudience("selected_class"));
    }
  }, [dispatch, isIndividual, publishState.testAudience]);

  const currentUserId = getStoredUser()?.id;
  const orgClassOptions = useMemo(() => {
    if (isIndividual) {
      return [];
    }
    return classList
      .filter((item) =>
        (item.classSubjects ?? []).some((row) =>
          (row.teachers ?? []).some((assignment) => assignment.teacher_id === currentUserId),
        ),
      )
      .map((item) => ({ label: item.class_name, value: item.id }));
  }, [classList, currentUserId, isIndividual]);

  useEffect(() => {
    if (isIndividual || !publishState.selectedClassId) {
      setAssignedSubjects([]);
      return;
    }

    let cancelled = false;
    const loadAssigned = async () => {
      setAssignedLoading(true);
      try {
        const response = await axiosReq.get<ApiResponse<AssignedClassSubject[]>>(
          `${process.env.NEXT_PUBLIC_BASE_URL}/classes/${publishState.selectedClassId}/subjects/assigned`,
        );
        if (!cancelled) {
          setAssignedSubjects(response.data?.payload ?? []);
        }
      } catch {
        if (!cancelled) {
          setAssignedSubjects([]);
        }
      } finally {
        if (!cancelled) {
          setAssignedLoading(false);
        }
      }
    };

    void loadAssigned();
    return () => {
      cancelled = true;
    };
  }, [isIndividual, publishState.selectedClassId]);

  useEffect(() => {
    if (isIndividual || formState.isModelTest || formState.examCategory === "ielts") {
      return;
    }
    if (!publishState.selectedClassId || assignedLoading) {
      return;
    }

    if (assignedSubjects.length === 0) {
      if (subjects.length > 0) {
        subjects.forEach((subject) => dispatch(removeSubject(subject.id)));
      }
      return;
    }

    const options = assignedSubjects.map(toSubjectOption);
    const current = subjects.find((subject) => subject.id === activeSubjectId) ?? subjects[0] ?? null;
    const stillValid = current ? options.some((option) => option.id === current.id) : false;

    if (assignedSubjects.length === 1) {
      if (current?.id !== options[0].id) {
        dispatch(setSingleSubject(options[0]));
      }
      return;
    }

    if (!stillValid && subjects.length > 0) {
      subjects.forEach((subject) => dispatch(removeSubject(subject.id)));
    }
  }, [
    activeSubjectId,
    assignedLoading,
    assignedSubjects,
    dispatch,
    formState.examCategory,
    formState.isModelTest,
    isIndividual,
    publishState.selectedClassId,
    subjects,
  ]);

  const catalogSubjectOptions = useMemo(() => {
    const catalogOptions = subjectCatalog.map((subject) => ({
      label: subject.name,
      value: subject.value,
      id: subject.id,
    }));
    const stateSubjectOptions = subjects.map((subject) => ({
      label: subject.name,
      value: subject.value,
      id: subject.id,
    }));

    return [...catalogOptions, ...stateSubjectOptions].filter(
      (option, index, options) => options.findIndex((item) => item.id === option.id) === index,
    );
  }, [subjectCatalog, subjects]);

  const orgSubjectOptions = useMemo(() => assignedSubjects.map(toSubjectOption), [assignedSubjects]);

  const subjectOptions = isIndividual ? catalogSubjectOptions : orgSubjectOptions;

  const selectedSubjectValue = useMemo(() => {
    const activeSubject = subjects.find((subject) => subject.id === activeSubjectId) ?? subjects[0] ?? null;
    return activeSubject?.value ?? "";
  }, [activeSubjectId, subjects]);

  const handleSubjectChange = useCallback(
    (value: string) => {
      const selectedSubject = subjectOptions.find((subject) => subject.value === value);
      if (!selectedSubject) {
        return;
      }
      dispatch(setSingleSubject(selectedSubject));
    },
    [dispatch, subjectOptions],
  );

  const handleClassChange = useCallback(
    (value: string) => {
      dispatch(setTestAudience("selected_class"));
      dispatch(setPublishField({ field: "selectedClassId", value }));
    },
    [dispatch],
  );

  const handleModelTestChange = useCallback(
    (checked: boolean) => {
      if (checked && !canCreateModelTests) {
        return;
      }
      dispatch(setFormField({ field: "isModelTest", value: checked }));
      if (!checked) {
        const keepSubject =
          subjects.find((subject) => subject.id === activeSubjectId) ?? subjects[0] ?? null;
        if (keepSubject) {
          dispatch(
            setSingleSubject({
              id: keepSubject.id,
              label: keepSubject.name,
              value: keepSubject.value,
            }),
          );
        }
      }
    },
    [activeSubjectId, canCreateModelTests, dispatch, subjects],
  );

  const modelTestCheckbox = (
    <Checkbox
      label={t("modelTest")}
      checked={formState.isModelTest}
      disabled={!canCreateModelTests}
      onChange={(event) => handleModelTestChange(event.target.checked)}
    />
  );

  const handleExamCategoryChange = useCallback(
    (category: "academic" | "ielts") => {
      dispatch(setFormField({ field: "examCategory", value: category }));
      if (category === "ielts") {
        // Clear academic subjects and seed Reading module
        dispatch(
          setSingleSubject({
            id: IELTS_MODULES[0].id,
            label: IELTS_MODULES[0].label,
            value: IELTS_MODULES[0].value,
          }),
        );
      } else {
        // Switching back to academic - clear IELTS modules
        const firstAcademicSubject = subjectCatalog[0];
        if (firstAcademicSubject) {
          dispatch(
            setSingleSubject({
              id: firstAcademicSubject.id,
              label: firstAcademicSubject.name,
              value: firstAcademicSubject.value,
            }),
          );
        }
      }
    },
    [dispatch, subjectCatalog],
  );

  const handleIeltsModuleToggle = useCallback(
    (module: typeof IELTS_MODULES[0], isChecked: boolean) => {
      if (isChecked) {
        dispatch(
          addSubject({
            id: module.id,
            label: module.label,
            value: module.value,
          }),
        );
        return;
      }

      const ieltsSubjects = subjects.filter((s) => s.id.startsWith("ielts."));
      if (ieltsSubjects.length <= 1) {
        return;
      }
      dispatch(removeSubject(module.id));
    },
    [dispatch, subjects],
  );

  const selectedIeltsModules = useMemo(() => {
    return new Set(subjects.filter((s) => s.id.startsWith("ielts.")).map((s) => s.id));
  }, [subjects]);

  const subjectCombobox = (label: string, options: Array<{ label: string; value: string }>) => (
    <Combobox
      label={label}
      placeholder={t("selectSubject")}
      value={selectedSubjectValue || null}
      onChange={(value) => value && handleSubjectChange(value)}
      options={options.map(({ label: optionLabel, value }) => ({ label: optionLabel, value }))}
    />
  );

  const orgSubjectSection = !formState.isModelTest && (
    <div className="flex flex-col gap-2">
      {!publishState.selectedClassId ? (
        <p className="text-body-sm text-ink-muted">{t("pickClassFirst")}</p>
      ) : assignedLoading ? (
        <p className="text-body-sm text-ink-muted">{t("loadingSubjects")}</p>
      ) : assignedSubjects.length === 0 ? (
        <p className="text-body-sm text-danger">{t("noSubject")}</p>
      ) : assignedSubjects.length === 1 ? (
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-medium text-ink">{t("orgSubject")}</p>
          <p className="rounded-input bg-canvas px-3 py-2.5 text-body text-ink">{assignedSubjectLabel(assignedSubjects[0])}</p>
        </div>
      ) : (
        subjectCombobox(t("orgSubject"), orgSubjectOptions)
      )}
    </div>
  );

  const isIelts = formState.examCategory === "ielts";

  return (
    <section className="flex w-full flex-1 flex-col gap-6">
      <Card title={tc("steps.Basic info")}>
        <div className="flex flex-col gap-5">
          <Input
            label={t("name")}
            required
            value={formState.testName}
            onChange={(event) => updateField("testName", event.target.value)}
            placeholder={t("namePlaceholder")}
          />

          {!isIndividual ? (
            orgClassOptions.length === 0 ? (
              <p className="text-body-sm text-danger">{isIelts ? t("noBatch") : t("noClass")}</p>
            ) : (
              <Combobox
                label={isIelts ? t("batch") : t("class")}
                required
                placeholder={isIelts ? t("selectBatch") : t("selectClass")}
                value={publishState.selectedClassId || null}
                onChange={(value) => value && handleClassChange(value)}
                options={orgClassOptions}
              />
            )
          ) : null}

          <RadioGroup
            legend={t("category")}
            name="examCategory"
            inline
            value={formState.examCategory ?? "academic"}
            onChange={(value) => handleExamCategoryChange(value as "academic" | "ielts")}
            options={EXAM_CATEGORIES.map((cat) => ({ value: cat.value, label: cat.value === "academic" ? t("academic") : "IELTS" }))}
          />

          {isIelts ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-body-sm font-medium text-ink">{t("ieltsModules")}</legend>
              <p className="-mt-1 text-caption text-ink-muted">{t("ieltsModulesHint")}</p>
              {IELTS_MODULES.map((module) => (
                <Checkbox
                  key={module.id}
                  label={tc.has(`ielts.${module.label}` as never) ? tc(`ielts.${module.label}` as never) : module.label}
                  checked={selectedIeltsModules.has(module.id)}
                  onChange={(event) => handleIeltsModuleToggle(module, event.target.checked)}
                />
              ))}
            </fieldset>
          ) : (
            <>
              {canCreateModelTests ? (
                modelTestCheckbox
              ) : (
                <Tooltip
                  content={
                    <span>
                      {t("modelTestLocked")}{" "}
                      <Link href="/billing" className="text-primary underline">
                        {t("upgrade")}
                      </Link>
                    </span>
                  }
                >
                  {modelTestCheckbox}
                </Tooltip>
              )}
              {!isIndividual
                ? orgSubjectSection
                : !formState.isModelTest
                  ? subjectCombobox(t("subject"), catalogSubjectOptions)
                  : null}
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t("duration")}
              required
              type="number"
              min={1}
              inputMode="numeric"
              value={formState.duration}
              onChange={(event) => updateField("duration", event.target.value)}
              placeholder={t("durationPlaceholder")}
              trailing={t("minutes")}
            />
            <Input
              label={t("passingScore")}
              type="number"
              min={0}
              inputMode="numeric"
              value={formState.passingScore}
              onChange={(event) => updateField("passingScore", event.target.value)}
              placeholder={t("passingPlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Checkbox
              label={t("negativeMarking")}
              hint={t("negativeMarkingHint")}
              checked={formState.allowNegativeMarking}
              onChange={(event) => updateField("allowNegativeMarking", event.target.checked)}
            />
            {formState.allowNegativeMarking ? (
              <Input
                label={t("negativePercent")}
                fieldClassName="sm:w-48"
                type="number"
                min={0}
                max={100}
                inputMode="decimal"
                value={formState.negativeMarking}
                onChange={(event) => updateField("negativeMarking", event.target.value)}
                placeholder="25"
                trailing="%"
              />
            ) : null}
          </div>
        </div>
      </Card>
    </section>
  );
});

BasicInfoStep.displayName = "BasicInfoStep";

export default BasicInfoStep;
