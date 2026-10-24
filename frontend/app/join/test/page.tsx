"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AuthLayout from "@/component/Auth/AuthLayout";
import SuccessIconSVG from "@/component/svg/SuccessIconSVG";
import { useIsClient } from "@/hooks/useBrowserStorage";

const INITIALSTATE: IJoinTest = { status: "loading" };

const errorState = (errorKey: JoinMessageKey, errorTitleKey: JoinMessageKey = "unavailableTitle"): IJoinTest => ({
  status: "error",
  errorKey,
  errorTitleKey,
});

// Builds the page state from the join details saved in browser storage. Browser-only.
const readJoinTestState = (): IJoinTest => {
  const testJoinResponse = sessionStorage.getItem("testJoinResponse");
  const joinSessionInfo = sessionStorage.getItem("joinSessionInfo");
  const user = localStorage.getItem("user");

  if (!testJoinResponse) {
    return errorState("noRequest");
  }

  if (!joinSessionInfo || !user) {
    return errorState("testDetailsMissing");
  }

  try {
    const parsedTestJoinResponse = JSON.parse(testJoinResponse);
    const parsedJoinSessionInfo = JSON.parse(joinSessionInfo);
    const parsedUser = JSON.parse(user);

    if (!parsedTestJoinResponse || !parsedJoinSessionInfo.id || !parsedUser.full_name) {
      return errorState("incomplete");
    }

    if (!parsedTestJoinResponse.eligible) {
      return errorState("notEligible", "notEligibleTitle");
    }

    return {
      status: "success",
      studentName: parsedUser.full_name,
      test: parsedJoinSessionInfo.test_name,
      teacher: parsedJoinSessionInfo.created_user_name,
      time: Number(parsedJoinSessionInfo.duration_minutes),
      testId: parsedJoinSessionInfo.id,
    };
  } catch {
    return errorState("unreadable");
  }
};

const JoinTest = () => {
  const router = useRouter();
  const t = useTranslations("join");
  const isClient = useIsClient();
  const [storedState, setStoredState] = useState<IJoinTest | null>(null);
  // Read storage once, on the first render in the browser.
  if (isClient && storedState === null) {
    setStoredState(readJoinTestState());
  }
  const pageState = storedState ?? INITIALSTATE;
  const title =
    pageState.status === "error"
      ? t(pageState.errorTitleKey ?? "unavailableTitle")
      : pageState.status === "success"
        ? t("welcomeTitle", { name: pageState.studentName ?? "" })
        : t("loadingTitle");

  const handleStartTest = () => {
    sessionStorage.removeItem("testJoinResponse");
    sessionStorage.removeItem("joinSessionInfo");
    sessionStorage.setItem("testId", pageState?.testId || "");
    router.push("/test/permissions");
  };

  const handleContinue = () => {
    sessionStorage.removeItem("testJoinResponse");
    sessionStorage.removeItem("joinSessionInfo");
    router.push("/");
  };

  return (
    <AuthLayout>
      <div className="flex w-full items-center justify-center font-ins-sans">
        <div className="flex w-full max-w-[460px] flex-col justify-center rounded-xl border-l border-l-border bg-surface shadow-lg max-md:max-w-full">
          <div className="flex flex-col items-start justify-center gap-6 p-6">
            <div className={pageState.status === "error" ? "text-danger" : "text-primary"}>
              <SuccessIconSVG width={40} />
            </div>

            <div className="flex w-full flex-col items-start gap-2">
              <p className="w-full text-title font-medium text-ink">
                {title}
              </p>
              {pageState.status === "error" && pageState.errorKey && (
                <p className="w-full text-body font-normal leading-5 text-danger">
                  {t(pageState.errorKey)}
                </p>
              )}{" "}
              {pageState.status === "loading" && (
                <p className="w-full text-body font-normal leading-5 text-ink-muted">
                  {t("checkingTest")}
                </p>
              )}
              {pageState?.status === "success" && (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex flex-row items-center w-full">
                    <div className="w-[25%] font-semibold text-body leading-5 text-ink-muted">
                      {t("test")}
                    </div>
                    <div className="w-[75%] font-medium text-body leading-5 text-ink-muted">
                      {pageState.test}
                    </div>
                  </div>
                  <div className="flex flex-row items-center w-full">
                    <div className="w-[25%] font-semibold text-body leading-5 text-ink-muted">
                      {t("teacher")}
                    </div>
                    <div className="w-[75%] font-medium text-body leading-5 text-ink-muted">
                      {pageState.teacher}
                    </div>
                  </div>
                  <div className="flex flex-row items-center w-full">
                    <div className="w-[25%] font-semibold text-body leading-5 text-ink-muted">
                      {t("time")}
                    </div>
                    <div className="w-[75%] font-medium text-body leading-5 text-ink-muted">
                      {Number.isFinite(pageState.time) ? t("minutes", { minutes: pageState.time ?? 0 }) : ""}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {pageState.status === "success" && (
            <>
              <div className="h-px w-full bg-border" />

              <div className="flex items-center justify-end p-4">
                <button
                  type="button"
                  onClick={handleStartTest}
                  className="flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-body-sm font-medium leading-4 text-ink-inverse transition-colors hover:bg-primary-hover"
                >
                  {t("startTest")}
                </button>
              </div>
            </>
          )}
          {pageState.status === "error" && (
            <>
              <div className="h-px w-full bg-border" />

              <div className="flex items-center justify-end p-4">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-body-sm font-medium leading-4 text-ink-inverse transition-colors hover:bg-primary-hover"
                >
                  {t("continue")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};

export default JoinTest;
