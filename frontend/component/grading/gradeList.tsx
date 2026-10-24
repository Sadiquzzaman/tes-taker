"use client";

import { useTranslations } from "next-intl";
import { Card, EmptyState, Pagination, Skeleton } from "@/design/ui";
import useGetGradeList from "@/hooks/api/grading/useGetGradeList";
import { setPage } from "@/lib/features/gradingSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import GradeCard from "./GradeCard";

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

/** Tests to grade, a page at a time, filtered by the header above. */
const GradeList = () => {
  const t = useTranslations("grading");
  const dispatch = useAppDispatch();
  const { page, activeTab, searchInput } = useAppSelector((state) => state.grade);
  const { apiComplete, gradeList, loading, meta } = useGetGradeList();
  const filtering = Boolean(searchInput.trim()) || activeTab.value !== "ALL";

  if (loading || !apiComplete) {
    return (
      <div className={GRID} aria-busy="true">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-card border border-border bg-surface p-4">
            <Skeleton lines={4} />
          </div>
        ))}
      </div>
    );
  }

  if (gradeList.length === 0) {
    return (
      <Card>
        <EmptyState title={filtering ? t("noMatch") : t("empty")} description={filtering ? undefined : t("emptyDetail")} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={GRID}>
        {gradeList.map((gradeItem) => (
          <GradeCard key={gradeItem.id} gradeItem={gradeItem} />
        ))}
      </div>
      <Pagination page={page} pageCount={meta?.total_pages ?? 1} onPageChange={(next) => dispatch(setPage(next))} />
    </div>
  );
};

export default GradeList;
