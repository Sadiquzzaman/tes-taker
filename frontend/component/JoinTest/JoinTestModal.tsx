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
      <div className="flex w-full max-w-[460px] flex-col justify-center rounded-xl border-l border-l-border bg-surface shadow-lg max-md:max-w-full">
        <div className="flex flex-col items-start justify-center gap-6 p-6">
          <div className={isError ? "text-danger" : "text-primary"}>
            <InviteIconSVG width={40} />
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <p className="w-full text-title font-medium text-ink">{title}</p>
            <p
              className={
                isError
                  ? "w-full text-body font-normal leading-5 text-danger"
                  : "w-full text-body font-normal leading-5 text-ink-muted"
              }
            >
              {isError ? (
                description
              ) : (
                <>
                  Here is a small test summary and you will have <b>{apiResponse?.payload?.duration_minutes} minutes</b>{" "}
                  to complete the test.{" "}
                  {testData?.test_audience === "selected_class"
                    ? "This is a private test, only Selected Students will be able to join."
                    : "This is a public test, any student will be able to join."}
                </>
              )}
            </p>
          </div>
        </div>

        {!isError ? (
          <>
            <div className="h-px w-full bg-border" />

            <div className="flex items-center justify-end p-6">
              <button
                type="button"
                onClick={handleContinue}
                className="flex h-10 items-center justify-center rounded-lg bg-primary px-4 pl-[14px] text-body-sm font-medium leading-4 text-ink-inverse transition-colors hover:bg-primary-hover"
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
