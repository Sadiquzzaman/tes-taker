"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/component/Auth/AuthLayout";
import SuccessIconSVG from "@/component/svg/SuccessIconSVG";

const INITIALSTATE: IJoinTest = {
  status: "loading",
  title: "Loading request",
  description: "Checking your test join request.",
};

const JoinTest = () => {
  const router = useRouter();
  const [pageState, setPageState] = useState<IJoinTest>(INITIALSTATE);

  const handleErrorState = (message: string, title: string = "Request unavailable") => {
    setPageState({
      status: "error",
      title,
      description: message,
    });
  };

  useEffect(() => {
    const testJoinResponse = sessionStorage.getItem("testJoinResponse");
    const joinSessionInfo = sessionStorage.getItem("joinSessionInfo");
    const user = localStorage.getItem("user");

    if (!testJoinResponse) {
      handleErrorState("No join request was found for this session.");
      return;
    }

    if (!joinSessionInfo || !user) {
      handleErrorState("Required join details are missing. Please try the test join flow again.");
      return;
    }

    try {
      const parsedTestJoinResponse = JSON.parse(testJoinResponse);
      const parsedJoinSessionInfo = JSON.parse(joinSessionInfo);
      const parsedUser = JSON.parse(user);

      console.log({
        parsedTestJoinResponse,
        parsedJoinSessionInfo,
        parsedUser,
      });

      if (!parsedTestJoinResponse || !parsedJoinSessionInfo.id || !parsedUser.full_name) {
        handleErrorState("The join information is incomplete.");
        return;
      }

      if (!parsedTestJoinResponse.eligible) {
        handleErrorState("You are not eligible to join this test.", "Not Eligible");
        return;
      }

      setPageState({
        status: "success",
        title: `Welcome ${parsedUser.full_name}`,
        test: parsedJoinSessionInfo.test_name,
        teacher: parsedJoinSessionInfo.created_user_name,
        time: parsedJoinSessionInfo.duration_minutes,
        testId: parsedJoinSessionInfo.id,
        description: "",
      });
    } catch {
      handleErrorState("Stored join information could not be read.");
    }
  }, []);

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
        <div className="flex w-full max-w-[460px] flex-col justify-center rounded-xl border-l border-l-[#E5E5E5] bg-white shadow-lg max-md:max-w-full">
          <div className="flex flex-col items-start justify-center gap-6 p-6">
            <div className={pageState.status === "error" ? "text-[#B93815]" : "text-[#5F8A66]"}>
              <SuccessIconSVG width={40} />
            </div>

            <div className="flex w-full flex-col items-start gap-2">
              <p className="w-full text-[24px] font-medium leading-[29px] tracking-[-0.02em] text-[#232A25]">
                {pageState.title}
              </p>
              {pageState?.status === "error" && (
                <p className="w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#B93815]">
                  {pageState.description}
                </p>
              )}{" "}
              {pageState?.status === "loading" && (
                <p className="w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#747775]">
                  {pageState.description}
                </p>
              )}
              {pageState?.status === "success" && (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex flex-row items-center w-full">
                    <div className="w-[25%] font-[600] text-[16px] leading-5 tracking-[-0.02em] text-[#747775]">
                      Test
                    </div>
                    <div className="w-[75%] font-[500] text-[16px] leading-5 tracking-[-0.02em] text-[#747775]">
                      {pageState.test}
                    </div>
                  </div>
                  <div className="flex flex-row items-center w-full">
                    <div className="w-[25%] font-[600] text-[16px] leading-5 tracking-[-0.02em] text-[#747775]">
                      Teacher
                    </div>
                    <div className="w-[75%] font-[500] text-[16px] leading-5 tracking-[-0.02em] text-[#747775]">
                      {pageState.teacher}
                    </div>
                  </div>
                  <div className="flex flex-row items-center w-full">
                    <div className="w-[25%] font-[600] text-[16px] leading-5 tracking-[-0.02em] text-[#747775]">
                      Time
                    </div>
                    <div className="w-[75%] font-[500] text-[16px] leading-5 tracking-[-0.02em] text-[#747775]">
                      {pageState.time}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {pageState.status === "success" && (
            <>
              <div className="h-px w-full bg-[#E5E5E5]" />

              <div className="flex items-center justify-end p-4">
                <button
                  type="button"
                  onClick={handleStartTest}
                  className="flex h-10 items-center justify-center rounded-lg bg-[#5F8A66] px-4 text-[14px] font-medium leading-4 tracking-[-0.02em] text-white transition-colors hover:bg-[#4f7655]"
                >
                  Start Test
                </button>
              </div>
            </>
          )}
          {pageState.status === "error" && (
            <>
              <div className="h-px w-full bg-[#E5E5E5]" />

              <div className="flex items-center justify-end p-4">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex h-10 items-center justify-center rounded-lg bg-[#5F8A66] px-4 text-[14px] font-medium leading-4 tracking-[-0.02em] text-white transition-colors hover:bg-[#4f7655]"
                >
                  Continue
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
