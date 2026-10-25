"use client";

import { Card, Skeleton } from "@/design/ui";
import useGetGradeDetails from "@/hooks/api/grading/useGetGradeDetails";
import ExamClassRosterPanel from "./ExamClassRosterPanel";
import GradeDetailsHeader from "./GradeDetailsHeader";
import GradeDetailsStats from "./GradeDetailsStats";
import GradingModel from "./GradingModel";
import StudentSubmissionsTable from "./StudentSubmissionsTable";

/** Grading one test: header, counts, class progress, submissions, and the marking drawer. */
const GradeDetailsComponent = ({ classId }: { classId: string }) => {
  const { apiComplete, fetch, loading } = useGetGradeDetails(classId);

  if (loading || !apiComplete) {
    return (
      <div className="flex flex-col gap-6 pb-8" aria-busy="true">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 rounded-card" />
          ))}
        </div>
        <Card>
          <Skeleton lines={6} />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <GradeDetailsHeader refetchGradeDetails={fetch} />
      <GradeDetailsStats />
      <StudentSubmissionsTable />
      <ExamClassRosterPanel examId={classId} />
      <GradingModel />
    </div>
  );
};

export default GradeDetailsComponent;
