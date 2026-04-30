"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/component/Auth/AuthLayout";

const SuccessIcon = ({ width = 40 }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 40 40" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M39.9998 15.905C39.9998 16.4384 39.6164 17.1767 39.4381 17.5317C38.7881 18.92 37.7214 21.0517 37.7214 23.5067C37.7214 28.8617 35.8298 31.525 34.3498 32.8867C32.6043 34.5095 30.3131 35.4178 27.9298 35.4317C25.9676 35.4308 24.0469 34.8662 22.3964 33.805C20.1198 32.2967 18.6981 29.9284 17.2498 27.5634C16.0964 25.6417 15.2981 24.13 14.0531 21.2034C13.3514 19.5067 12.6981 17.85 12.1364 16.0467C11.8698 15.19 11.8998 14.5384 12.2248 14.125C12.5498 13.7417 12.9948 13.5634 13.5248 13.5334C14.4414 13.5034 14.7981 14.155 15.3298 15.84C15.6548 16.905 16.3064 18.445 16.6898 19.3017C17.1931 20.3367 17.9031 21.7267 18.2281 22.2017C18.4948 22.6184 18.7314 22.735 18.9964 22.735C19.4698 22.735 19.8248 22.4684 19.8248 21.9967C19.8248 21.73 19.5581 21.2867 19.4114 21.02C19.1448 20.5167 18.5831 19.5117 18.1981 18.6534C17.7408 17.602 17.3167 16.5364 16.9264 15.4584C16.6898 14.8367 16.4248 13.95 16.1581 13.0634C15.7448 11.7034 15.5364 10.875 15.5364 10.2517C15.5364 9.30503 16.2464 8.68503 17.3114 8.68503C18.0798 8.68503 18.5831 9.06836 18.9081 10.4584C19.1748 11.73 19.6481 13.8017 20.3281 15.4284C20.7714 16.4934 21.4214 17.915 21.8064 18.625C22.0431 19.0384 22.3081 19.3934 22.3081 19.5417C22.3081 19.7484 21.9248 20.075 21.5981 20.5167C21.3914 20.7834 21.3031 20.9617 21.3031 21.1667C21.3031 21.345 21.4214 21.5234 21.5981 21.76C21.7764 21.9967 21.9531 22.2334 22.1614 22.2334C22.3081 22.2334 22.3981 22.1734 22.4864 22.055C23.3289 20.9905 24.3755 20.1048 25.5648 19.45C26.9248 18.6817 28.3164 18.2967 29.4114 18.06C29.9431 17.9434 30.0914 17.8234 30.0914 17.5267C30.0914 17.1734 29.8248 16.9667 29.4698 16.9367C29.2031 16.9067 28.9681 16.9367 28.5531 16.9667C28.2581 16.9967 28.1098 16.8484 27.9331 16.4634C27.3998 15.34 26.3664 13.445 25.7448 11.02C25.4364 9.85532 25.2191 8.66841 25.0948 7.47003C25.0048 6.81836 25.1231 6.58169 25.4481 6.28669C25.8631 5.93169 26.6014 5.78336 27.1648 5.93169C27.8431 6.10836 28.1981 6.64169 28.5531 8.71503C28.7314 9.69003 29.0264 10.9317 29.3814 11.9984C29.8248 13.3584 30.3864 14.485 31.2448 15.9934C31.7181 16.8217 32.3081 17.6784 32.9298 18.51C32.8114 18.865 32.6048 19.1 31.9248 19.6634C31.2448 20.225 30.5648 20.8167 29.9431 21.91C29.4998 22.7084 29.2931 23.595 29.2931 24.1867C29.2931 24.7484 29.4098 24.8667 29.7664 24.8667C30.3864 24.8667 30.8898 24.75 30.9198 24.4834C31.0664 23.4167 31.2448 22.7384 31.8364 21.9367C32.1898 21.4934 32.8114 20.9317 33.3148 20.4867C34.2598 19.72 34.5864 19.275 34.9114 18.1817C35.0581 17.6784 35.2364 17.205 35.4731 16.7617C36.0348 15.7284 37.0398 14.545 38.6098 14.545C39.1131 14.545 39.5264 14.6917 39.7931 15.1067C39.9301 15.3503 40.0013 15.6255 39.9998 15.905ZM21.0131 12.1084C21.2798 13.205 21.6048 14.1517 21.9298 14.98C22.3131 15.9884 22.7581 16.8467 23.3798 17.9984C23.6748 18.56 23.8214 18.56 24.5314 18.1767C25.1805 17.8428 25.8528 17.5559 26.5431 17.3184C25.4781 15.0117 24.5914 13.0867 24.1481 11.4617C23.8966 10.4035 23.6798 9.33739 23.4981 8.26503C23.4081 7.43669 23.3198 6.72669 23.1131 5.95836C22.8764 5.01169 22.5498 4.56836 21.6331 4.56836C20.7764 4.56836 19.7414 5.01169 19.7414 6.13503C19.7414 6.87503 19.9481 7.96836 20.1548 8.85336C20.5098 9.71336 20.5698 10.245 21.0131 12.1084ZM8.53976 24.02C7.82309 24.2134 4.74643 25.3267 4.00476 25.615C3.16643 25.94 2.57643 26.235 2.99643 27.485C3.33809 28.4967 3.91809 28.545 4.45309 28.345C5.20309 28.0684 8.52309 26.3284 9.14976 25.9417C9.71642 25.5917 9.89976 25.325 9.63309 24.66C9.39143 24.055 9.04309 23.885 8.53976 24.02ZM6.41309 18.8967C6.83309 18.8834 7.15976 18.7467 7.25976 18.02C7.33809 17.4617 7.24976 17.17 6.60976 16.9717C5.99143 16.7817 2.10643 16.1484 1.26809 16.0684C0.544759 15.9984 0.0980919 16.0684 0.0130919 17.2134C-0.0685748 18.28 0.229759 18.6067 0.966425 18.68C1.81309 18.7634 5.52143 18.92 6.41309 18.8967ZM2.02976 8.76003C2.81976 9.23169 5.85143 11.0684 6.87309 11.3917C7.38309 11.5517 7.65309 11.4084 7.93976 10.84C8.22643 10.2717 8.30309 10.045 7.75476 9.60336C7.18809 9.14669 4.21642 6.83503 3.37476 6.39669C2.64976 6.02003 2.15976 6.16503 1.71976 6.99836C1.22143 7.94169 1.31309 8.32836 2.02809 8.76003H2.02976Z"
        fill="currentColor"
      />
    </svg>
  );
};

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
              <SuccessIcon width={40} />
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
