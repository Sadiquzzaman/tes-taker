"use client";

import StudentExamPermissionFlow from "@/component/Tests/exam/StudentExamPermissionFlow";
import { isExamPermissionsComplete } from "@/utils/tests/examSessionMedia";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TestPermissionsPage() {
  const router = useRouter();
  const [testId, setTestId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setTestId(sessionStorage.getItem("testId"));
    setIsMounted(true);
  }, []);

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

  return <StudentExamPermissionFlow />;
}
