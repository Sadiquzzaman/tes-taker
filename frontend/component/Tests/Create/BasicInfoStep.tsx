import { setFormField } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import DropDownComponent from "@/Ui/DropDownComponent";
import NormalInput from "@/Ui/NormalInput";
import { memo, useCallback } from "react";

const subjects = [
  { label: "Mathematics", value: "math" },
  { label: "Science", value: "science" },
  { label: "English", value: "english" },
  { label: "History", value: "history" },
];

const examTypes = [
  { label: "Multiple choice (MCQ)", value: "mcq" },
  { label: "Essay writing", value: "essay" },
  { label: "Hybrid - A combination of different questions", value: "hybrid" },
  { label: "Model Test - Multiple subjects", value: "model" },
];

const BasicInfoStep = memo(({ formState }: BasicInfoStepProps) => {
  const dispatch = useAppDispatch();

  const updateField = useCallback(
    (field: keyof FormState, value: FormState[keyof FormState]) => {
      dispatch(setFormField({ field, value }));
    },
    [dispatch],
  );

  return (
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
          list={examTypes}
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
          <DropDownComponent
            placeholder="Select subject"
            value={formState.subject}
            handleChange={(value) => updateField("subject", value)}
            list={subjects}
          />
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
  );
});

BasicInfoStep.displayName = "BasicInfoStep";

export default BasicInfoStep;
