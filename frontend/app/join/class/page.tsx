"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/component/Auth/AuthLayout";
import SuccessIconSVG from "@/component/svg/SuccessIconSVG";

const INITIALSTATE: IJoinClass = {
  status: "loading",
  title: "Loading request",
  description: (
    <p className="w-full whitespace-pre-line text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#747775]">
      Checking your class request.
    </p>
  ),
};

const JoinClass = () => {
  const router = useRouter();
  const [pageState, setPageState] = useState<IJoinClass>(INITIALSTATE);

  const handleErrorState = (message: string) => {
    setPageState({
      status: "error",
      title: "Request unavailable",
      description: (
        <p className="w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#B93815]">{message}</p>
      ),
    });
  };

  useEffect(() => {
    const classJoinResponse = sessionStorage.getItem("classJoinResponse");
    const joinSessionInfo = sessionStorage.getItem("joinSessionInfo");
    const user = localStorage.getItem("user");

    if (!classJoinResponse) {
      handleErrorState("No join request was found for this session.");
      return;
    }

    if (!joinSessionInfo || !user) {
      handleErrorState("Required join details are missing. Please try the class invite flow again.");
      return;
    }

    try {
      const parsedClassJoinResponse = JSON.parse(classJoinResponse);
      const parsedJoinSessionInfo = JSON.parse(joinSessionInfo);
      const parsedUser = JSON.parse(user);

      if (!parsedClassJoinResponse.class_id || !parsedJoinSessionInfo.class_name || !parsedUser.full_name) {
        handleErrorState("The join information is incomplete.");
        return;
      }

      if (parsedClassJoinResponse.status === "PENDING") {
        setPageState({
          status: "pending",
          title: `Request pending ${parsedUser.full_name}`,
          description: (
            <p className="w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#747775]">
              You have requested to join
              <br />
              Class: {parsedJoinSessionInfo.class_name}
              <br />
              Teacher: {parsedJoinSessionInfo.created_user_name}.
            </p>
          ),
        });
        return;
      }

      if (parsedClassJoinResponse.status === "JOINED") {
        setPageState({
          status: "joined",
          title: `Welcome ${parsedUser.full_name}`,
          description: (
            <p className="w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#747775]">
              You have joined Class: {parsedJoinSessionInfo.class_name}
              <br />
              Teacher: {parsedJoinSessionInfo.created_user_name}.
            </p>
          ),
        });
        return;
      }
    } catch {
      handleErrorState("Stored join information could not be read.");
    }
  }, []);

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
                {pageState.title}
              </p>
              {pageState.description}
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

export default JoinClass;
