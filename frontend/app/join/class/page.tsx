"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AuthLayout from "@/component/Auth/AuthLayout";
import SuccessIconSVG from "@/component/svg/SuccessIconSVG";
import { useIsClient } from "@/hooks/useBrowserStorage";

const INITIALSTATE: IJoinClass = { status: "loading" };

const errorState = (errorKey: JoinMessageKey): IJoinClass => ({ status: "error", errorKey });

// Builds the page state from the join details saved in browser storage. Browser-only.
const readJoinClassState = (): IJoinClass => {
  const classJoinResponse = sessionStorage.getItem("classJoinResponse");
  const joinSessionInfo = sessionStorage.getItem("joinSessionInfo");
  const user = localStorage.getItem("user");

  if (!classJoinResponse) {
    return errorState("noRequest");
  }

  if (!joinSessionInfo || !user) {
    return errorState("classDetailsMissing");
  }

  try {
    const parsedClassJoinResponse = JSON.parse(classJoinResponse);
    const parsedJoinSessionInfo = JSON.parse(joinSessionInfo);
    const parsedUser = JSON.parse(user);

    if (!parsedClassJoinResponse.class_id || !parsedJoinSessionInfo.class_name || !parsedUser.full_name) {
      return errorState("incomplete");
    }

    const details = {
      studentName: parsedUser.full_name,
      className: parsedJoinSessionInfo.class_name,
      teacher: parsedJoinSessionInfo.created_user_name,
    };

    if (parsedClassJoinResponse.status === "PENDING") {
      return { status: "pending", ...details };
    }

    if (parsedClassJoinResponse.status === "JOINED") {
      return { status: "joined", ...details };
    }
  } catch {
    return errorState("unreadable");
  }

  return INITIALSTATE;
};

const JoinClass = () => {
  const router = useRouter();
  const t = useTranslations("join");
  const isClient = useIsClient();
  const [storedState, setStoredState] = useState<IJoinClass | null>(null);
  // Read storage once, on the first render in the browser.
  if (isClient && storedState === null) {
    setStoredState(readJoinClassState());
  }
  const pageState = storedState ?? INITIALSTATE;
  const details = {
    name: pageState.studentName ?? "",
    className: pageState.className ?? "",
    teacher: pageState.teacher ?? "",
  };
  const richDetails = { ...details, br: () => <br /> };
  const title =
    pageState.status === "error"
      ? t("unavailableTitle")
      : pageState.status === "pending"
        ? t("pendingTitle", details)
        : pageState.status === "joined"
          ? t("welcomeTitle", details)
          : t("loadingTitle");
  const description =
    pageState.status === "error" && pageState.errorKey
      ? t(pageState.errorKey)
      : pageState.status === "pending"
        ? t.rich("pendingDescription", richDetails)
        : pageState.status === "joined"
          ? t.rich("joinedDescription", richDetails)
          : t("checkingClass");

  const handleContinue = () => {
    sessionStorage.removeItem("classJoinResponse");
    sessionStorage.removeItem("joinSessionInfo");
    router.push("/");
  };

  return (
    <AuthLayout>
      <div className="flex w-full items-center justify-center font-ins-sans">
        <div className="flex w-full max-w-[460px] flex-col justify-center rounded-xl border-l border-l-[#E5E5E5] bg-white shadow-lg max-md:max-w-full">
          <div className="flex flex-col items-start justify-center gap-6 p-6">
            <div className={pageState.status === "error" ? "text-[#B93815]" : "text-[#5F8A66]"}>
              <SuccessIconSVG width={40} />
            </div>

            <div className="flex w-full flex-col items-start gap-2">
              <p className="w-full text-[24px] font-medium leading-[29px] tracking-[-0.02em] text-[#232A25]">
                {title}
              </p>
              <p
                className={`w-full whitespace-pre-line text-[16px] font-normal leading-5 tracking-[-0.02em] ${
                  pageState.status === "error" ? "text-[#B93815]" : "text-[#747775]"
                }`}
              >
                {description}
              </p>
            </div>
          </div>

          {!(pageState.status === "loading") && (
            <>
              <div className="h-px w-full bg-[#E5E5E5]" />

              <div className="flex items-center justify-end p-4">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex h-10 items-center justify-center rounded-lg bg-[#5F8A66] px-4 text-[14px] font-medium leading-4 tracking-[-0.02em] text-white transition-colors hover:bg-[#4f7655]"
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

export default JoinClass;
