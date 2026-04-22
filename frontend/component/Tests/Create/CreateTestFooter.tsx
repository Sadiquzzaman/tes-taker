import Link from "next/link";
import MusicPreviousIconSVG from "@/component/svg/MusicPreviousIconSVG";
import MusicNextIconSVG from "@/component/svg/MusicNextIconSVG";
import RightArrowIconSVG from "@/component/svg/RightArrowIconSVG";

type CreateTestFooterProps = {
  currentStep: CreateTestStep;
  isFirstStep: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void | Promise<void>;
};

const CreateTestFooter = ({ currentStep, isFirstStep, isSubmitting, onBack, onNext }: CreateTestFooterProps) => {
  const isPublishStep = currentStep === "Publish";

  return (
    <div className="mt-auto flex items-center justify-between pt-4 pr-8">
      <Link
        href="/tests"
        className="flex h-9 items-center justify-center rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-[#232A25]"
      >
        Cancel
      </Link>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirstStep || isSubmitting}
          className="flex h-9 items-center justify-center gap-1 rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-[#747775] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MusicPreviousIconSVG />
          <div className="mb-[2px]">Back</div>
        </button>
        <button
          type="button"
          onClick={() => {
            void onNext();
          }}
          disabled={isSubmitting}
          className="flex h-9 items-center justify-center gap-1 rounded-[8px] bg-[#49734F] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="mb-[2px]">{isSubmitting && isPublishStep ? "Publishing..." : isPublishStep ? "Publish Test" : "Next"}</div>
          {isPublishStep ? <RightArrowIconSVG /> : <MusicNextIconSVG />}
        </button>
      </div>
    </div>
  );
};

export default CreateTestFooter;