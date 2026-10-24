import BlackTickIconSVG from "@/component/svg/BlackTickIconSVG";
import createTestSteps from "@/lib/features/create-test/createTestSteps";
import { setCurrentStep } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";

const CreateTestStepSidebar = ({ currentStep }: CreateTestStepSidebarProps) => {
  const dispatch = useAppDispatch();
  const currentStepIndex = createTestSteps.indexOf(currentStep);
  const progressWidth = `${(currentStepIndex / (createTestSteps.length - 1)) * 100}%`;

  return (
    <aside className="w-full rounded-card bg-[rgba(239,240,243,0.75)] px-4 py-2 lg:p-5 lg:h-full lg:w-[260px] lg:min-w-[260px]">
      <div className="flex h-full flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-body-sm font-normal text-ink-muted">Steps</p>
            <p className="text-body-sm font-normal text-ink-muted">
              {currentStepIndex + 1}/{createTestSteps.length}
            </p>
          </div>
          <div className="hidden h-1 w-full overflow-hidden rounded-[19px] bg-border lg:block">
            <div className="h-1 rounded-[19px] bg-primary" style={{ width: progressWidth }} />
          </div>
        </div>

        <div className="hidden lg:flex lg:flex-col lg:gap-4">
          {createTestSteps.map((step, index) => {
            const isActive = step === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <button
                key={step}
                type="button"
                onClick={() => dispatch(setCurrentStep(step))}
                className="flex items-center gap-2 text-left transition-opacity hover:opacity-80"
              >
                {isCompleted ? (
                  <BlackTickIconSVG />
                ) : (
                  <span
                    className={`relative h-4 w-4 rounded-full border ${
                      isActive ? "border-primary bg-surface" : "border-ink-muted bg-transparent"
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                    ) : null}
                  </span>
                )}

                <span
                  className={`text-body font-medium leading-4 ${
                    isActive ? "text-primary" : isCompleted ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {step}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

export default CreateTestStepSidebar;
