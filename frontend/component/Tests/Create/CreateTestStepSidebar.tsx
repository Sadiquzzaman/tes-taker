import BlackTickIconSVG from "@/component/svg/BlackTickIconSVG";
import { createTestSteps } from "@/lib/features/create-test/createTestDomain";

type CreateTestStepSidebarProps = {
  currentStep: CreateTestStep;
};

const CreateTestStepSidebar = ({ currentStep }: CreateTestStepSidebarProps) => {
  const currentStepIndex = createTestSteps.indexOf(currentStep);
  const progressWidth = `${(currentStepIndex / (createTestSteps.length - 1)) * 100}%`;

  return (
    <aside className="h-full rounded-[12px] bg-[rgba(239,240,243,0.75)] p-5 md:w-[260px] md:min-w-[260px]">
      <div className="flex h-full flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">Steps</p>
            <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">
              {currentStepIndex + 1}/{createTestSteps.length}
            </p>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-[19px] bg-[#E5E5E5]">
            <div className="h-1 rounded-[19px] bg-[#49734F]" style={{ width: progressWidth }} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {createTestSteps.map((step, index) => {
            const isActive = step === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <label key={step} className="flex items-center gap-2">
                {isCompleted ? (
                  <BlackTickIconSVG />
                ) : (
                  <span
                    className={`relative h-4 w-4 rounded-full border ${
                      isActive ? "border-[#49734F] bg-white" : "border-[#747775] bg-transparent"
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#49734F]" />
                    ) : null}
                  </span>
                )}

                <span
                  className={`text-[16px] font-[500] leading-4 tracking-[-0.02em] ${
                    isActive ? "text-[#49734F]" : isCompleted ? "text-[#232A25]" : "text-[#747775]"
                  }`}
                >
                  {step}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

export default CreateTestStepSidebar;