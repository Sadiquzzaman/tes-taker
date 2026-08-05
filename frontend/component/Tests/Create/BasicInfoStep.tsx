import { setFormField, setSingleSubject } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import DropDownComponent from "@/Ui/DropDownComponent";
import NormalInput from "@/Ui/NormalInput";
import Tooltip from "@/Ui/Tooltip";
import useGetAllSubject from "@/hooks/api/subject/useGetAllSubject";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo } from "react";

const BasicInfoStep = memo(({ formState }: BasicInfoStepProps) => {
  const dispatch = useAppDispatch();
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const subjectCatalog = useAppSelector((state) => state.subject.subjects);
  const { subjects, activeSubjectId } = createTestState;
  const { hasFeature } = useEntitlements();
  const canCreateModelTests = hasFeature("allow_model_tests");
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

  const subjectOptions = useMemo(() => {
    const catalogSubjectOptions = subjectCatalog.map((subject) => ({
      label: subject.name,
      value: subject.value,
      id: subject.id,
    }));
    const stateSubjectOptions = subjects.map((subject) => ({
      label: subject.name,
      value: subject.value,
      id: subject.id,
    }));

    return [...catalogSubjectOptions, ...stateSubjectOptions].filter(
      (option, index, options) => options.findIndex((item) => item.id === option.id) === index,
    );
  }, [subjectCatalog, subjects]);

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
    <label
      className={`flex items-center gap-2 py-1 ${canCreateModelTests ? "" : "cursor-not-allowed opacity-60"}`}
    >
      <input
        type="checkbox"
        checked={formState.isModelTest}
        disabled={!canCreateModelTests}
        onChange={(e) => handleModelTestChange(e.target.checked)}
        className="h-5 w-5 rounded border-[#747775] text-[#49734F] focus:ring-0 disabled:cursor-not-allowed"
      />
      <span className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#232A25]">
        Is model test?
      </span>
    </label>
  );

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">Basic Info</h2>
      </div>
      <div className="w-full border-b border-[#E5E5E5]" />

      <div className="flex w-full flex-col gap-2">
        <p className="text-[15px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Test name</p>
        <NormalInput
          value={formState.testName}
          onChange={(e) => updateField("testName", e.target.value)}
          parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
          inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
          placeholder="e.g., Algebra Midterm Assessment"
          afterIcon={null}
        />
      </div>

      {canCreateModelTests ? (
        modelTestCheckbox
      ) : (
        <Tooltip
          content={
            <span>
              Model tests are available on Pro.{" "}
              <Link href="/billing" className="underline text-[#49734F]">
                Upgrade
              </Link>
            </span>
          }
        >
          {modelTestCheckbox}
        </Tooltip>
      )}

      {!formState.isModelTest ? (
        <div className="flex flex-col gap-2">
          <label className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Subject</label>
          <DropDownComponent
            placeholder="Select subject"
            value={selectedSubjectValue}
            handleChange={handleSubjectChange}
            isSearchable={true}
            maxOuputInDropdownList={5}
            list={subjectOptions.map(({ label, value }) => ({ label, value }))}
          />
        </div>
      ) : null}

      <div className="flex w-full flex-col gap-2">
        <p className="text-[15px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Duration</p>
        <NormalInput
          value={formState.duration}
          onChange={(e) => updateField("duration", e.target.value)}
          parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
          inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
          placeholder="e.g., 90"
          afterIcon={null}
          afterText={<div className="text-[#747775]">minutes</div>}
          type="number"
        />
      </div>
      <div className="flex w-full flex-col gap-2">
        <p className="text-[15px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
          Passing score (Optional)
        </p>
        <NormalInput
          value={formState.passingScore}
          onChange={(e) => updateField("passingScore", e.target.value)}
          parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
          inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
          placeholder="e.g., 40"
          afterIcon={null}
          type="number"
        />
      </div>

      <div className="flex w-full justify-between gap-2">
        <label className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={formState.allowNegativeMarking}
            onChange={(e) => updateField("allowNegativeMarking", e.target.checked)}
            className="h-5 w-5 rounded border-[#747775] text-[#49734F] focus:ring-0"
          />
          <span className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#232A25]">
            Negative marking
          </span>
        </label>
        {formState.allowNegativeMarking && (
          <div className="w-48">
            <NormalInput
              value={formState.negativeMarking}
              onChange={(e) => updateField("negativeMarking", e.target.value)}
              parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
              inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
              placeholder="e.g., 40"
              afterIcon={null}
              afterText={<div className="text-[#747775]">%</div>}
              type="number"
            />
          </div>
        )}
      </div>
    </section>
  );
});

BasicInfoStep.displayName = "BasicInfoStep";

export default BasicInfoStep;
