import { useEffect, useState } from "react";

const useJoinStateManage = (page: "login" | "signup") => {
  const [joinInfo, setJoinInfo] = useState<any>(null);

  useEffect(() => {
    const joinSessionInfo = sessionStorage.getItem("joinSessionInfo");
    if (joinSessionInfo) {
      const parsedInfo = JSON.parse(joinSessionInfo);
      const pageName = page === "login" ? "Login" : page === "signup" ? "Sign Up" : "";
      const headerText =
        parsedInfo?.joinType === "class"
          ? `${pageName} Required to Join ${parsedInfo.class_name}`
          : parsedInfo?.joinType === "test"
            ? `${pageName} Required to participate in ${parsedInfo.test_name} test`
            : "";

      setJoinInfo({
        ...parsedInfo,
        headerText,
      });
    } else {
      setJoinInfo(null);
    }
  }, [page]);

  return { joinInfo };
};

export default useJoinStateManage;
