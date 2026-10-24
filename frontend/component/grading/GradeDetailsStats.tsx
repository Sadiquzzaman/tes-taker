"use client";

import { useTranslations } from "next-intl";
import { StatTile } from "@/design/ui";
import { useAppSelector } from "@/lib/hooks";

/** Students, submissions, waiting and graded counts for the test. */
const GradeDetailsStats = () => {
  const t = useTranslations("grading.details");
  const stats = useAppSelector((state) => state.gradeDetails.stats);
  const tiles = [
    { key: "students", label: t("totalStudents"), value: stats?.total_students ?? 0 },
    { key: "submissions", label: t("submissions"), value: stats?.submissions ?? 0 },
    { key: "pending", label: t("pending"), value: stats?.pending ?? 0 },
    { key: "graded", label: t("graded"), value: stats?.graded ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.key} label={tile.label} value={tile.value} />
      ))}
    </div>
  );
};

export default GradeDetailsStats;
