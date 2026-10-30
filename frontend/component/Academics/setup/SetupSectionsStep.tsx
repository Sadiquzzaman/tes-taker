"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card, EmptyState, Skeleton } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";
import ClassSections from "../ClassSections";

/** Step 4: the sections (batches) of each class, with shift, room and class teacher (the class screens' own card). */
const SetupSectionsStep = () => {
  const t = useTranslations("academics.setup.sections");
  const { baseUrl, run } = useAcademicsRequest();
  const [classes, setClasses] = useState<AcademicSetupSummary["classes"] | null>(null);

  useEffect(() => {
    void run(() => axiosReq.get<ApiResponse<AcademicSetupSummary>>(`${baseUrl}/setup`)).then((res) => setClasses(res?.data?.payload?.classes ?? []));
  }, [baseUrl, run]);

  if (classes === null) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }

  if (classes.length === 0) {
    return (
      <Card>
        <EmptyState title={t("noClasses")} description={t("noClassesDetail")} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-sm text-ink-muted">{t("intro")}</p>
      {classes.map((setupClass) => (
        <section key={setupClass.id} aria-label={setupClass.name} className="flex flex-col gap-2">
          <h3 className="text-title-sm font-semibold text-ink">{setupClass.name}</h3>
          <ClassSections classId={setupClass.id} />
        </section>
      ))}
    </div>
  );
};

export default SetupSectionsStep;
