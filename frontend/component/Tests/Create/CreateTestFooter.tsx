import Link from "next/link";
import MusicPreviousIconSVG from "@/component/svg/MusicPreviousIconSVG";
import MusicNextIconSVG from "@/component/svg/MusicNextIconSVG";
import RightArrowIconSVG from "@/component/svg/RightArrowIconSVG";

const CreateTestFooter = ({ currentStep, isFirstStep, isSubmitting, onBack, onNext }: CreateTestFooterProps) => {
  const isPublishStep = currentStep === "Publish";
  const isBackDisabled = Boolean(isFirstStep) || Boolean(isSubmitting);
  const isNextDisabled = Boolean(isSubmitting);

  return (
    <div className="mt-auto flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between md:pr-8">
      <Link
        href="/tests"
        className="flex h-9 w-full items-center justify-center rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-[#232A25] md:w-auto"
      >
        Cancel
      </Link>

      <div className="flex w-full items-center gap-3 md:w-auto md:gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isBackDisabled}
          className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-[#747775] disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
        >
          <MusicPreviousIconSVG />
          <div className="mb-[2px]">Back</div>
        </button>
        <button
          type="button"
          onClick={() => {
            void onNext();
          }}
          disabled={isNextDisabled}
          className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[8px] bg-[#49734F] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-white disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
        >
          <div className="mb-[2px]">
            {isSubmitting && isPublishStep ? "Publishing..." : isPublishStep ? "Publish Test" : "Next"}
          </div>
          {isPublishStep ? <RightArrowIconSVG /> : <MusicNextIconSVG />}
        </button>
      </div>
    </div>
  );
};

export default CreateTestFooter;
