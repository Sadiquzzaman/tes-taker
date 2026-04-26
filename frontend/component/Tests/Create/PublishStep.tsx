import { useCallback, useState } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setPublishTiming,
  setPublishField,
  setTestAudience,
  addExcludedStudent,
  removeExcludedStudent,
} from "@/lib/features/createTestSlice";
import DropDownComponent from "@/Ui/DropDownComponent";
import TagInput from "@/Ui/TagInput";
import { testAudienceOptions } from "@/utils/createTestOptions";
import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import PublishSchedule from "./PublishSchedule";
import { useToast } from "@/component/Toast/ToastContext";

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4.5" y="4.5" width="8" height="8" rx="1" stroke="white" strokeWidth="1" />
    <path d="M1.5 9.5V2.5C1.5 1.95 1.95 1.5 2.5 1.5H9.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

const JOIN_LINK = "app.testaker.com/join/class/ABCD1234";

const PublishStep = () => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const publishState = useAppSelector((state) => (state.createTest as CreateTestState).publishState);
  const { classList } = useGetAllClass();

  const [studentInput, setStudentInput] = useState("");
  const [copied, setCopied] = useState(false);

  const classOptions = classList.map((c) => ({ label: c.class_name, value: c.id }));

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JOIN_LINK).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleAddStudent = useCallback(() => {
    const trimmed = studentInput.trim();
    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d+$/;

    if (!emailRegex.test(trimmed) && !phoneRegex.test(trimmed)) {
      triggerToast({
        title: "Invalid input",
        description: "Please enter a valid email address or phone number.",
        type: "error",
      });
    } else if (trimmed.includes("@") && !emailRegex.test(trimmed)) {
      triggerToast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        type: "error",
      });
    } else if (phoneRegex.test(trimmed) && trimmed.length !== 11) {
      triggerToast({
        title: "Invalid phone number",
        description: "Phone number must be 11 digits.",
        type: "error",
      });
    } else {
      dispatch(addExcludedStudent(trimmed));
      setStudentInput("");
    }
  }, [studentInput, dispatch]);

  const handleRemoveStudent = useCallback(
    (index: number) => {
      dispatch(removeExcludedStudent(index));
    },
    [dispatch],
  );

  const renderPublishOptionButton = (title: string, description: string, timing: PublishTiming) => (
    <button
      type="button"
      onClick={() => dispatch(setPublishTiming(timing))}
      className={`flex flex-1 cursor-pointer items-start gap-3 rounded-[8px] p-4 transition-colors ${
        publishState.publishTiming === timing ? "bg-[#49734F]" : "bg-[#EFF0F3]"
      }`}
    >
      <span
        className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
          publishState.publishTiming === timing ? "border-white bg-white" : "border-[#747775] bg-transparent"
        }`}
      >
        {publishState.publishTiming === timing && <span className="h-3 w-3 rounded-full bg-[#49734F]" />}
      </span>
      <div className="flex flex-col gap-2 text-left">
        <span
          className={`text-[16px] font-[500] leading-4 tracking-[-0.02em] ${
            publishState.publishTiming === timing ? "text-white" : "text-[#232A25]"
          }`}
        >
          {title}
        </span>
        <span
          className={`text-[14px] font-[400] leading-4 tracking-[-0.02em] ${
            publishState.publishTiming === timing ? "text-[#E5E5E5]" : "text-[#747775]"
          }`}
        >
          {description}
        </span>
      </div>
    </button>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <section className="flex h-full w-full flex-1 flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[24px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">Publish timing</h2>
          </div>
          <div className="w-full border-b border-[#E5E5E5]" />

          <div className="flex gap-3">
            {renderPublishOptionButton("Publish immediately", "This test will be available from now", "immediately")}
            {renderPublishOptionButton(
              "Schedule for later",
              "This test will be available on selected date & time",
              "later",
            )}
          </div>

          {publishState.publishTiming === "later" && <PublishSchedule />}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[24px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">Test Audience</h2>
          </div>
          <div className="w-full border-b border-[#E5E5E5]" />

          <div className="flex flex-col gap-2">
            <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Test Created for</p>
            <DropDownComponent
              placeholder="Select audience"
              value={publishState.testAudience}
              handleChange={(value) => dispatch(setTestAudience(value as TestAudience))}
              list={testAudienceOptions}
            />
          </div>

          {publishState.testAudience === "selected_class" && (
            <div className="flex flex-col gap-2">
              <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Select a class</p>
              <DropDownComponent
                placeholder="Select class"
                value={publishState.selectedClassId}
                handleChange={(value) => dispatch(setPublishField({ field: "selectedClassId", value }))}
                list={classOptions}
              />
              {publishState.selectedClassId && (
                <>
                  <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">
                    Students in this class will be able to join the test.
                  </p>

                  <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">
                    Exclude Student email or phone <span className="font-[400] text-[#747775]">(Optional)</span>
                  </p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <TagInput
                        value={studentInput}
                        onChange={(e) => setStudentInput(e.target.value)}
                        tags={publishState.excluded_students}
                        addTag={handleAddStudent}
                        removeTag={handleRemoveStudent}
                        placeholder="Exclude by single/bulk email or phone."
                        afterIcon={null}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddStudent}
                      className="flex h-[44px] items-center gap-[6px] rounded-[8px] bg-[#232A25] px-3 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-white"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="5.5" cy="4" r="2.5" stroke="white" strokeWidth="1.2" />
                        <path
                          d="M1 12C1 9.79086 3.01472 8 5.5 8"
                          stroke="white"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        <path d="M10 9V13M8 11H12" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      Add
                    </button>
                  </div>
                  <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">
                    Exclude by single/bulk email or phone.
                  </p>
                </>
              )}
            </div>
          )}

          {publishState.testAudience === "anyone" && (
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-[600] leading-[125%] tracking-[-0.02em] text-[#0F1A12]">Class Join Link</p>
              <div className="flex items-center justify-between rounded-[6px] bg-[#EFF0F3]/75 px-3 py-[6px]">
                <span className="text-[16px] font-[400] leading-5 tracking-[-0.02em] text-[#2765EC]">{JOIN_LINK}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-[6px] rounded-[8px] bg-[#232A25] px-3 py-2 text-[14px] font-[500] leading-4 tracking-[-0.02em] capitalize text-white"
                >
                  <CopyIcon />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">
                You can copy the link now or later to share with your students.
              </p>
            </div>
          )}
        </div>
      </section>
    </LocalizationProvider>
  );
};

export default PublishStep;
