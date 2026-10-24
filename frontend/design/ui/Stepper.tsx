"use client";

import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";
import { cn } from "./cn";
import { CheckIcon } from "./icons";

export interface StepperProps {
  /** Step names; wizards have at most 5 (design-system §3.4). */
  steps: string[];
  /** 0-based index of the current step. */
  current: number;
  className?: string;
}

/** Progress through a wizard. On phones only "Step 2 of 4: Name" is shown. */
const Stepper = ({ steps, current, className }: StepperProps) => {
  const t = useTranslations("ui.stepper");
  const format = useFormat();

  return (
    <nav aria-label={t("label")} className={className}>
      <p className="text-body-sm text-ink sm:hidden">
        <span className="text-ink-muted">{t("step", { current: current + 1, total: steps.length })}: </span>
        <span className="font-medium">{steps[current]}</span>
      </p>
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "current" : "upcoming";
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
                  state === "done" && "bg-primary text-ink-inverse",
                  state === "current" && "border-2 border-primary bg-surface text-primary",
                  state === "upcoming" && "border border-border bg-surface text-ink-muted",
                )}
              >
                {state === "done" ? (
                  <>
                    <CheckIcon className="size-3.5" />
                    <span className="sr-only">{t("done")}</span>
                  </>
                ) : (
                  format.number(index + 1)
                )}
              </span>
              <span className={cn("truncate text-body-sm", state === "upcoming" ? "text-ink-muted" : "font-medium text-ink")}>
                {step}
              </span>
              {index < steps.length - 1 ? (
                <span aria-hidden="true" className={cn("h-px min-w-4 flex-1", index < current ? "bg-primary" : "bg-border")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Stepper;
