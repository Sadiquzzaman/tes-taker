import { useCallback, useMemo, useState } from "react";
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
import { buildTestJoinLink, getFrontendAppUrl } from "@/utils/frontendAppUrl";
import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import useWorkspace from "@/hooks/organization/useWorkspace";
import PublishSchedule from "./PublishSchedule";
import { useToast } from "@/component/Toast/ToastContext";
import AddStudentIconSVG from "@/component/svg/AddStudentIconSVG";
import PublishCopyIconSVG from "@/component/svg/PublishCopyIconSVG";

const PublishStep = () => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const publishState = useAppSelector((state) => (state.createTest as CreateTestState).publishState);
  const editExamId = useAppSelector((state) => (state.createTest as CreateTestState).editExamId);
  const examCategory = useAppSelector(
    (state) => (state.createTest as CreateTestState).formState.examCategory ?? "academic",
  );
  const { classList } = useGetAllClass();
  const { isIndividual } = useWorkspace();
  const selectedClass = classList.find((item) => item.id === publishState.selectedClassId);
  const classLabel = examCategory === "ielts" ? "batch" : "class";
  const classLabelTitle = examCategory === "ielts" ? "Batch" : "Class";

  const [studentInput, setStudentInput] = useState("");
  const [copied, setCopied] = useState(false);

  const classOptions = classList.map((c) => ({ label: c.class_name, value: c.id }));

  const joinLink = useMemo(() => {
    if (editExamId) {
      return buildTestJoinLink(editExamId);
    }

    return `${getFrontendAppUrl()}/join/test/<id-after-publish>`;
  }, [editExamId]);

  const canCopyJoinLink = Boolean(editExamId);

  const handleCopy = useCallback(() => {
    if (!canCopyJoinLink) {
      triggerToast({
        title: "Link unavailable",
        description: "Publish or save the test first to get a shareable join link.",
        type: "error",
      });
      return;
    }

    navigator.clipboard.writeText(joinLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [canCopyJoinLink, joinLink, triggerToast]);

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
  }, [studentInput, dispatch, triggerToast]);

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
      className={`flex flex-1 cursor-pointer items-start gap-3 rounded-input p-4 transition-colors ${
        publishState.publishTiming === timing ? "bg-primary" : "bg-canvas"
      }`}
    >
      <span
        className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
          publishState.publishTiming === timing ? "border-surface bg-surface" : "border-ink-muted bg-transparent"
        }`}
      >
        {publishState.publishTiming === timing && <span className="h-3 w-3 rounded-full bg-primary" />}
      </span>
      <div className="flex flex-col gap-2 text-left">
        <span
          className={`text-body font-medium leading-4 ${
            publishState.publishTiming === timing ? "text-ink-inverse" : "text-ink"
          }`}
        >
          {title}
        </span>
        <span
          className={`text-body-sm font-normal leading-4 ${
            publishState.publishTiming === timing ? "text-border" : "text-ink-muted"
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
            <h2 className="text-title font-semibold leading-6 tracking-tight text-ink-muted">Publish timing</h2>
          </div>
          <div className="w-full border-b border-border" />

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
            <h2 className="text-title font-semibold leading-6 tracking-tight text-ink-muted">Test Audience</h2>
          </div>
          <div className="w-full border-b border-border" />

          <div className="flex flex-col gap-2">
            <p className="text-body font-medium text-ink">Test Created for</p>
            {isIndividual ? (
              <DropDownComponent
                placeholder="Select audience"
                value={publishState.testAudience}
                handleChange={(value) => dispatch(setTestAudience(value as TestAudience))}
                list={testAudienceOptions}
              />
            ) : (
              <p className="rounded-input bg-canvas px-3 py-3 text-sm text-ink">
                Group or {classLabel}
                {selectedClass?.class_name ? ` — ${selectedClass.class_name}` : ""}
              </p>
            )}
          </div>

          {(isIndividual ? publishState.testAudience === "selected_class" : true) && (
            <div className="flex flex-col gap-2">
              <p className="text-body font-medium text-ink">
                Select a {classLabel}
              </p>
              {isIndividual ? (
                <DropDownComponent
                  placeholder={`Select ${classLabel}`}
                  value={publishState.selectedClassId}
                  handleChange={(value) => dispatch(setPublishField({ field: "selectedClassId", value }))}
                  list={classOptions}
                  maxOuputInDropdownList={5}
                />
              ) : (
                <p className="rounded-input border border-border px-3 py-3 text-sm text-ink">
                  {selectedClass?.class_name || `${classLabelTitle} selected in Basic Info`}
                </p>
              )}
              {publishState.selectedClassId && (
                <>
                  <p className="text-body-sm font-normal text-ink-muted">
                    Students in this {classLabel} will be able to join the test.
                  </p>

                  <p className="text-body font-medium text-ink">
                    Exclude Student email or phone <span className="font-normal text-ink-muted">(Optional)</span>
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
                      className="flex h-[44px] items-center gap-[6px] rounded-input bg-ink px-3 text-body-sm font-medium leading-4 text-ink-inverse"
                    >
                      <AddStudentIconSVG width={14} />
                      Add
                    </button>
                  </div>
                  <p className="text-body-sm font-normal text-ink-muted">
                    Exclude by single/bulk email or phone.
                  </p>
                </>
              )}
            </div>
          )}

          {isIndividual && publishState.testAudience === "anyone" && (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm font-semibold text-ink">Test Join Link</p>
              <div className="flex items-center justify-between rounded-input bg-canvas/75 px-3 py-[6px]">
                <span className="break-all text-body font-normal leading-5 text-info">
                  {joinLink}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!canCopyJoinLink}
                  className="flex shrink-0 items-center gap-[6px] rounded-input bg-ink px-3 py-2 text-body-sm font-medium leading-4 capitalize text-ink-inverse disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PublishCopyIconSVG width={14} />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-body font-normal text-ink-muted">
                {canCopyJoinLink
                  ? "You can copy the link now or later to share with your students."
                  : "A shareable join link will be available after you publish this test."}
              </p>
            </div>
          )}
        </div>
      </section>
    </LocalizationProvider>
  );
};

export default PublishStep;
