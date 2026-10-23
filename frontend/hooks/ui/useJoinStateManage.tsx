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

  const joinInfo = useMemo<JoinInfo | null>(() => {
    if (!joinSessionInfo) {
      return null;
    }

    const parsedInfo = JSON.parse(joinSessionInfo) as JoinSessionInfo;
    const pageName = page === "login" ? "Login" : page === "signup" ? "Sign Up" : "";
    const headerText =
      parsedInfo?.joinType === "class"
        ? `${pageName} Required to Join ${parsedInfo.class_name}`
        : parsedInfo?.joinType === "test"
          ? `${pageName} Required to participate in ${parsedInfo.test_name} test`
          : "";

    return {
      ...parsedInfo,
      headerText,
    };
  }, [joinSessionInfo, page]);

  return { joinInfo };
};

export default useJoinStateManage;
