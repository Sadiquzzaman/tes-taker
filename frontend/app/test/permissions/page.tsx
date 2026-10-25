"use client";

import ExamMessageScreen from "@/component/Tests/exam/ExamMessageScreen";
import StudentExamPermissionFlow from "@/component/Tests/exam/StudentExamPermissionFlow";
import useExamEligibility from "@/hooks/api/exam/useExamEligibility";
import { useIsClient } from "@/hooks/useBrowserStorage";
import { isExamPermissionsComplete } from "@/utils/tests/examSessionMedia";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ExamLoading from "@/component/Tests/exam/ExamLoading";

export default function TestPermissionsPage() {
  const router = useRouter();
  const isMounted = useIsClient();
  const [storedTestId, setStoredTestId] = useState<{ value: string | null } | null>(null);
  // Read once, on the first render in the browser.
  if (isMounted && storedTestId === null) {
    setStoredTestId({ value: sessionStorage.getItem("testId") });
  }
  const testId = storedTestId?.value ?? null;

  const {
    loading: eligibilityLoading,
    checked: eligibilityChecked,
    eligibility,
    messageVariant,
  } = useExamEligibility(testId, isMounted && Boolean(testId));

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (!testId) {
      router.replace("/");
      return;
    }

    if (isExamPermissionsComplete()) {
      router.replace("/test");
    }
  }, [isMounted, router, testId]);

  if (!isMounted || !testId) {
    return null;
  }

  if (eligibilityLoading || !eligibilityChecked) {
    return (
      <div className="flex min-h-dvh">
        <ExamLoading />
      </div>
    );
  }

  if (messageVariant) {
    return <ExamMessageScreen variant={messageVariant} reason={eligibility?.reason} />;
  }

  return <StudentExamPermissionFlow />;
}
