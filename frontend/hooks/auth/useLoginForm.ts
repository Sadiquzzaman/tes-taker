import { useState } from "react";
import useLogin from "@/hooks/api/useLogin";
import useJoinStateManage from "@/hooks/ui/useJoinStateManage";
import { validateLoginForm } from "@/utils/auth/validation";

export const useLoginForm = () => {
  const { joinInfo } = useJoinStateManage("login");
  const [loginInfo, setLoginInfo] = useState<LoginInfo>({
    identifier: "",
    password: "",
  });
  const [formError, setFormError] = useState({
    identifier: "",
    password: "",
  });
  const [loginUser, , { loading }] = useLogin();

  const handleFieldChange = (field: "identifier" | "password", value: string) => {
    setFormError((prev) => ({ ...prev, [field]: "" }));
    setLoginInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const errors = validateLoginForm(loginInfo);
    if (errors.identifier || errors.password) {
      setFormError({
        identifier: errors.identifier || "",
        password: errors.password || "",
      });
      return;
    }

    setFormError({ identifier: "", password: "" });

    const identifier = loginInfo.identifier.trim();
    if (identifier.includes("@")) {
      loginUser({ email: identifier.toLowerCase(), password: loginInfo.password });
    } else {
      loginUser({ phone: identifier, password: loginInfo.password });
    }
  };

  return {
    loginInfo,
    formError,
    loading,
    joinInfo,
    handleFieldChange,
    handleSubmit,
  };
};

export default useLoginForm;
