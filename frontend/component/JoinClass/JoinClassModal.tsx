"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, cn } from "@/design/ui";
import InviteIconSVG from "../svg/InviteIconSVG";

/** The class invite page: who invited you, and sign up or log in to join. */
const JoinClassModal = ({ classData, classId, apiResponse, errorMessage }: JoinClassModalProps) => {
  const t = useTranslations("classes.join");
  const router = useRouter();
  const isError = Boolean(errorMessage);
  const title = isError
    ? t("unavailable")
    : t("title", { className: classData?.class_name ?? "", teacher: classData?.created_user_name ?? "" });
  const description = isError ? errorMessage : classData?.description || t("noDescription");

  const persistJoinSession = () => {
    if (!apiResponse) {
      return;
    }
    sessionStorage.setItem(
      "joinSessionInfo",
      JSON.stringify({ id: classId, className: apiResponse?.payload?.class_name, ...apiResponse?.payload, joinType: "class" }),
    );
  };

  const go = (path: "/login" | "/signup") => {
    persistJoinSession();
    router.push(path);
  };

  return (
    <div className="flex w-full items-center justify-center">
      <div className="flex w-full max-w-md flex-col rounded-card border border-border bg-surface shadow-overlay">
        <div className="flex flex-col gap-6 p-6">
          <span className={isError ? "text-danger" : "text-primary"}>
            <InviteIconSVG width={40} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-title font-semibold text-ink">{title}</h1>
            <p className={cn("text-body", isError ? "text-danger" : "text-ink-muted")}>{description}</p>
          </div>
        </div>
        {!isError ? (
          <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => go("/signup")}>
              {t("signUp")}
            </Button>
            <Button onClick={() => go("/login")}>{t("logIn")}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default JoinClassModal;
