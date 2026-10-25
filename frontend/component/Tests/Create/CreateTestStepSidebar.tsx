"use client";

import { useTranslations } from "next-intl";
import { cn, focusRing, Stepper } from "@/design/ui";
import { CheckIcon } from "@/design/ui/icons";
import useFormat from "@/i18n/useFormat";
import createTestSteps from "@/lib/features/create-test/createTestSteps";
import { setCurrentStep } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";

/** The wizard's steps: a compact "Step 2 of 5" on phones, a clickable list on large screens. */
const CreateTestStepSidebar = ({ currentStep }: CreateTestStepSidebarProps) => {
  const t = useTranslations("createTest.steps");
  const tu = useTranslations("ui.stepper");
  const format = useFormat();
  const dispatch = useAppDispatch();
  const currentIndex = createTestSteps.indexOf(currentStep);
  const names = createTestSteps.map((step) => t(step));

  return (
    <aside className="w-full lg:w-60 lg:shrink-0">
      <Stepper steps={names} current={currentIndex} className="lg:hidden" />
      <nav aria-label={tu("label")} className="hidden rounded-card border border-border bg-surface p-4 shadow-card lg:block">
        <p className="mb-3 text-caption text-ink-muted">{tu("step", { current: currentIndex + 1, total: createTestSteps.length })}</p>
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-primary" style={{ width: `${(currentIndex / (createTestSteps.length - 1)) * 100}%` }} />
        </div>
        <ol className="flex flex-col gap-1">
          {createTestSteps.map((step, index) => {
            const isActive = index === currentIndex;
            const isDone = index < currentIndex;
            return (
              <li key={step}>
                <button
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => dispatch(setCurrentStep(step))}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-input px-2 py-2 text-left text-body-sm font-medium",
                    isActive ? "bg-primary-soft text-primary" : isDone ? "text-ink hover:bg-canvas" : "text-ink-muted hover:bg-canvas",
                    focusRing,
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-caption",
                      isDone ? "bg-primary text-ink-inverse" : isActive ? "border-2 border-primary text-primary" : "border border-border",
                    )}
                  >
                    {isDone ? <CheckIcon className="size-3.5" /> : format.number(index + 1)}
                  </span>
                  {names[index]}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
};

export default CreateTestStepSidebar;
