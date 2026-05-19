"use client";

import { useRouter } from "next/navigation";
import InviteIconSVG from "../svg/InviteIconSVG";

const JoinTestModal = ({ testData, testId, apiResponse, errorMessage }: JoinTestModalProps) => {
  console.log({ testData, apiResponse, errorMessage, testId });
  const router = useRouter();
  const isError = Boolean(errorMessage);
  const title = isError
    ? "Test unavailable"
    : `Join '${testData?.test_name ?? ""}' test by ${testData?.created_user_name ?? ""}`;
  const description = isError ? errorMessage : testData?.description || "Log in to continue with this test invitation.";

  const handleContinue = () => {
    if (!apiResponse) {
      return;
    }

    sessionStorage.setItem(
      "joinSessionInfo",
      JSON.stringify({
        ...apiResponse.payload,
        joinType: "test",
      }),
    );

    router.push("/login");
  };

  return (
    <div className="flex w-full items-center justify-center font-ins-sans">
      <div className="flex w-full max-w-[460px] flex-col justify-center rounded-xl border-l border-l-[#E5E5E5] bg-white shadow-lg max-md:max-w-full">
        <div className="flex flex-col items-start justify-center gap-6 p-6">
          <div className={isError ? "text-[#B93815]" : "text-[#49734F]"}>
            <InviteIconSVG width={40} />
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <p className="w-full text-[24px] font-medium leading-[29px] tracking-[-0.02em] text-[#232A25]">{title}</p>
            <p
              className={
                isError
                  ? "w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#B93815]"
                  : "w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#747775]"
              }
            >
              Here is a small test summary and you will have <b>{apiResponse?.payload?.duration_minutes} minutes</b> to
              complete the test.{" "}
              {testData?.test_audience === "selected_class"
                ? "This is a private test, only Selected Students will be able to join."
                : "This is a public test, any student will be able to join."}
            </p>
          </div>
        </div>

        {!isError ? (
          <>
            <div className="h-px w-full bg-[#E5E5E5]" />

            <div className="flex items-center justify-end p-6">
              <button
                type="button"
                onClick={handleContinue}
                className="flex h-10 items-center justify-center rounded-lg bg-[#49734F] px-4 pl-[14px] text-[14px] font-medium leading-4 tracking-[-0.02em] text-white transition-colors hover:bg-[#3f6244]"
              >
                Continue
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default JoinTestModal;
