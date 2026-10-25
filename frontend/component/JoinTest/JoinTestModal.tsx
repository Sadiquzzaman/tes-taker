"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, cn } from "@/design/ui";
import InviteIconSVG from "../svg/InviteIconSVG";

/** The test invite page: what the test is, how long it takes, and continue to log in. */
const JoinTestModal = ({ testData, apiResponse, errorMessage }: JoinTestModalProps) => {
  const t = useTranslations("tests.join");
  const router = useRouter();
  const isError = Boolean(errorMessage);

  const handleContinue = () => {
    if (!apiResponse) {
      return;
    }
    sessionStorage.setItem("joinSessionInfo", JSON.stringify({ ...apiResponse.payload, joinType: "test" }));
    router.push("/login");
  };

  return (
    <div className="flex w-full items-center justify-center">
      <div className="flex w-full max-w-md flex-col rounded-card border border-border bg-surface shadow-overlay">
        <div className="flex flex-col gap-6 p-6">
          <span className={isError ? "text-danger" : "text-primary"}>
            <InviteIconSVG width={40} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-title font-semibold text-ink">
              {isError ? t("unavailable") : t("title", { testName: testData?.test_name ?? "", teacher: testData?.created_user_name ?? "" })}
            </h1>
            {isError ? (
              <p className={cn("text-body text-danger")}>{errorMessage}</p>
            ) : (
              <>
                {testData?.description ? <p className="text-body text-ink-muted">{testData.description}</p> : null}
                <p className="text-body text-ink-muted">{t("duration", { minutes: apiResponse?.payload?.duration_minutes ?? 0 })}</p>
                <p className="text-body text-ink-muted">{testData?.test_audience === "selected_class" ? t("private") : t("public")}</p>
              </>
            )}
          </div>
        </div>
        {!isError ? (
          <div className="flex justify-end border-t border-border p-4">
            <Button onClick={handleContinue}>{t("continue")}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default JoinTestModal;
