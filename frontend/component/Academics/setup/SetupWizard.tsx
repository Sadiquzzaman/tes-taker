"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, PageHeader, Skeleton, Stepper } from "@/design/ui";
import LevelLabelsCard from "@/component/Organization/LevelLabelsCard";
import OrganizationSettingsCard from "@/component/Organization/OrganizationSettingsCard";
import OrganizationWorkspaceGate from "@/component/Organization/OrganizationWorkspaceGate";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";
import SetupClassesStep from "./SetupClassesStep";
import SetupSectionsStep from "./SetupSectionsStep";
import SetupSessionStep from "./SetupSessionStep";
import SetupSummaryStep from "./SetupSummaryStep";

const STEPS = ["basics", "session", "classes", "sections", "summary"] as const;

/**
 * The academic setup wizard of a school or coaching centre (P2-04, FND-02): names and language,
 * the session, classes and subjects, sections, then a summary before finishing. Every step saves
 * as it goes, so the wizard can be left and picked up again.
 */
const SetupWizardContent = () => {
  const t = useTranslations("academics.setup");
  const router = useRouter();
  const { baseUrl, run, organizationId, ownsWorkspace } = useAcademicsRequest();
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<AcademicSetupSummary | null>(null);
  const [finishing, setFinishing] = useState(false);

  const loadSummary = async () => {
    setSummary(null);
    const res = await run(() => axiosReq.get<ApiResponse<AcademicSetupSummary>>(`${baseUrl}/setup`));
    setSummary(res?.data?.payload ?? null);
  };

  const goTo = (next: number) => {
    setStep(next);
    if (STEPS[next] === "summary") void loadSummary();
  };

  const finish = async () => {
    setFinishing(true);
    const done = await run(() => axiosReq.post(`${baseUrl}/setup/complete`), t("finished"));
    setFinishing(false);
    if (done) router.push("/organization");
  };

  const canFinish = Boolean(summary && summary.classes.length > 0 && summary.classes.every((c) => c.section_count > 0));
  const current = STEPS[step];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} />
      <Stepper steps={STEPS.map((key) => t(`steps.${key}`))} current={step} />

      {current === "basics" && organizationId ? (
        <div className="flex flex-col gap-6">
          {ownsWorkspace ? <LevelLabelsCard /> : <Card title={t("basics.namesTitle")}>{t("basics.ownerOnly")}</Card>}
          <OrganizationSettingsCard organizationId={organizationId} />
        </div>
      ) : null}
      {current === "session" ? <SetupSessionStep /> : null}
      {current === "classes" && organizationId ? <SetupClassesStep organizationId={organizationId} /> : null}
      {current === "sections" ? <SetupSectionsStep /> : null}
      {current === "summary" ? (
        summary ? (
          <SetupSummaryStep summary={summary} />
        ) : (
          <Card aria-busy="true">
            <Skeleton lines={4} />
          </Card>
        )
      ) : null}

      <div className="flex justify-between gap-3">
        <Button variant="secondary" disabled={step === 0} onClick={() => goTo(step - 1)}>
          {t("back")}
        </Button>
        {current === "summary" ? (
          <Button onClick={() => void finish()} disabled={!canFinish} loading={finishing}>
            {t("finish")}
          </Button>
        ) : (
          <Button onClick={() => goTo(step + 1)}>{t("next")}</Button>
        )}
      </div>
    </div>
  );
};

const SetupWizard = () => (
  <OrganizationWorkspaceGate allowedRoles={["OWNER", "ADMIN"]}>
    <SetupWizardContent />
  </OrganizationWorkspaceGate>
);

export default SetupWizard;
