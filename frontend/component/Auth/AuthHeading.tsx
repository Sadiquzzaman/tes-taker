import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/design/ui";

/** The title of an auth step, with a small "step x of y" indicator when the flow has steps. */
const AuthHeading = ({ title, step, steps, children }: { title: string; step?: number; steps?: number; children?: ReactNode }) => {
  const t = useTranslations("ui.stepper");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-display font-semibold tracking-tight text-ink">{title}</h1>
        {step && steps ? (
          <div className="flex shrink-0 gap-0.5" role="img" aria-label={t("step", { current: step, total: steps })}>
            {Array.from({ length: steps }, (_, index) => (
              <span key={index} className={cn("h-1 w-4 rounded-full", index < step ? "bg-primary" : "bg-border")} />
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
};

export default AuthHeading;
