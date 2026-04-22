import { setFormField, setSingleSubject } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import DropDownComponent from "@/Ui/DropDownComponent";
import { createTestExamTypeOptions } from "@/utils/createTestOptions";
import NormalInput from "@/Ui/NormalInput";
import { memo, useCallback, useMemo, useState } from "react";
import PlusIcon from "@/component/svg/PlusIcon";
import AddSubjectModal from "./AddSubjectModal";
import useGetAllSubject from "@/hooks/api/subject/useGetAllSubject";

const BasicInfoStep = memo(({ formState }: BasicInfoStepProps) => {
  const dispatch = useAppDispatch();
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const subjectCatalog = useAppSelector((state) => state.subject.subjects);
  const { subjects, activeSubjectId } = createTestState;
  const [openAddSubjectModal, setOpenAddSubjectModal] = useState(false);
  useGetAllSubject();

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

  const updateField = useCallback(
    (field: keyof FormState, value: FormState[keyof FormState]) => {
      dispatch(setFormField({ field, value }));
    },
    [dispatch],
  );

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

  const handleSubjectCreated = useCallback(
    (subject: { id: string; label: string; value: string }) => {
      dispatch(setSingleSubject(subject));
    },
    [dispatch],
  );

  return (
    <>
      <section className="flex min-h-[532px] w-full flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[24px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">Basic Info</h2>
        </div>
        <div className="w-full border-b border-[#E5E5E5]" />

        <div className="flex flex-col gap-2">
          <label className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Exam type</label>
          <DropDownComponent
            placeholder="Select type"
            value={formState.examType}
            handleChange={(value) => updateField("examType", value)}
            list={createTestExamTypeOptions}
          />
        </div>

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

        {formState.examType !== "model" && (
          <div className="flex flex-col gap-2">
            <label className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Subject</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <DropDownComponent
                  placeholder="Select subject"
                  value={selectedSubjectValue}
                  handleChange={handleSubjectChange}
                  isSearchable={true}
                  maxVisibleOptions={10}
                  list={subjectOptions.map(({ label, value }) => ({ label, value }))}
                />
              </div>
              {/* <button
                type="button"
                onClick={() => setOpenAddSubjectModal(true)}
                className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#E5E5E5] transition-colors duration-200 hover:bg-[#F8F8F8]"
                title="Add new subject"
                aria-label="Add new subject"
              >
                <PlusIcon />
              </button> */}
            </div>
          </div>
        )}

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

      <AddSubjectModal
        open={openAddSubjectModal}
        onClose={() => setOpenAddSubjectModal(false)}
        onCreated={handleSubjectCreated}
      />
    </>
  );
});

BasicInfoStep.displayName = "BasicInfoStep";

export default BasicInfoStep;
