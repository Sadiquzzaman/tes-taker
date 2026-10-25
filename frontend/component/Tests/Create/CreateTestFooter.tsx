"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/design/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@/design/ui/icons";
import { useAppSelector } from "@/lib/hooks";

/** Cancel, Back and Next (or Publish on the last step) under the wizard. */
const CreateTestFooter = ({ currentStep, isFirstStep, isSubmitting, onBack, onNext }: CreateTestFooterProps) => {
  const t = useTranslations("createTest.footer");
  const isEditing = Boolean(useAppSelector((state) => (state.createTest as CreateTestState).editExamId));
  const isPublishStep = currentStep === "Publish";

  return (
    <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface py-3 sm:flex-row sm:items-center sm:justify-between">
      <NextLink href="/tests" className={buttonClasses({ variant: "ghost" })}>
        {t("cancel")}
      </NextLink>
      <div className="flex gap-2">
        <Button variant="secondary" leftIcon={<ChevronLeftIcon />} onClick={onBack} disabled={Boolean(isFirstStep) || Boolean(isSubmitting)} className="flex-1 sm:flex-none">
          {t("back")}
        </Button>
        <Button
          rightIcon={isPublishStep ? undefined : <ChevronRightIcon />}
          loading={Boolean(isSubmitting)}
          onClick={() => void onNext()}
          className="flex-1 sm:flex-none"
        >
          {isPublishStep ? (isSubmitting ? t("publishing") : isEditing ? t("save") : t("publish")) : t("next")}
        </Button>
      </div>
    </div>
  );
};

export default CreateTestFooter;
