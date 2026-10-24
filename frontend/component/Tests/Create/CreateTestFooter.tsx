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
        className="flex h-9 w-full items-center justify-center rounded-input bg-canvas px-4 text-body-sm font-medium leading-4 text-ink md:w-auto"
      >
        Cancel
      </Link>

      <div className="flex w-full items-center gap-3 md:w-auto md:gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isBackDisabled}
          className="flex h-9 flex-1 items-center justify-center gap-1 rounded-input bg-canvas px-4 text-body-sm font-medium leading-4 text-ink-muted disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
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
          className="flex h-9 flex-1 items-center justify-center gap-1 rounded-input bg-primary px-4 text-body-sm font-medium leading-4 text-ink-inverse disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
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
