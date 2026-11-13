"use client";

import useIsStudent from "@/component/Homework/useIsStudent";
import { Card, Skeleton } from "@/design/ui";
import { getStoredUser } from "@/lib/authSession";
import ClassDashboard from "./ClassDashboard";
import StudentPerformanceView from "./StudentPerformanceView";

/** Results → Performance (P7-03): staff see the class dashboard; a student sees their own page. */
const PerformancePage = () => {
  const isStudent = useIsStudent();
  if (isStudent === undefined) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }
  const me = getStoredUser()?.id;
  return isStudent && me ? <StudentPerformanceView studentId={me} own /> : <ClassDashboard />;
};

export default PerformancePage;
