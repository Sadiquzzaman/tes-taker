import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useStorageItem } from "@/hooks/useBrowserStorage";

// Saved in sessionStorage by the class/test join flow before the user logs in or signs up.
type JoinSessionInfo = {
  id?: string;
  joinType?: "class" | "test";
  class_name?: string;
  test_name?: string;
  [key: string]: unknown;
};

type JoinInfo = JoinSessionInfo & { headerText: string };

const useJoinStateManage = (page: "login" | "signup") => {
  const joinSessionInfo = useStorageItem("session", "joinSessionInfo");
  const t = useTranslations("auth.joinHeader");

  const joinInfo = useMemo<JoinInfo | null>(() => {
    if (!joinSessionInfo) {
      return null;
    }

    const parsedInfo = JSON.parse(joinSessionInfo) as JoinSessionInfo;
    const headerText =
      parsedInfo?.joinType === "class"
        ? t(page === "login" ? "loginClass" : "signupClass", { name: String(parsedInfo.class_name ?? "") })
        : parsedInfo?.joinType === "test"
          ? t(page === "login" ? "loginTest" : "signupTest", { name: String(parsedInfo.test_name ?? "") })
          : "";

    return {
      ...parsedInfo,
      headerText,
    };
  }, [joinSessionInfo, page, t]);

  return { joinInfo };
};

export default useJoinStateManage;
