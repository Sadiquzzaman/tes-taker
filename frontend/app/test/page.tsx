"use client";

import { useEffect, useState } from "react";

export default function ParticipateTest() {
  const [testId, setTestId] = useState<string | null>(null);
  useEffect(() => {
    const testId = sessionStorage.getItem("testId") || null;
    setTestId(testId);
  }, []);

  return <></>;
}
