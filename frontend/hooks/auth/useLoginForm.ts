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
  const [loginUser, { loading }] = useLogin();

  const handleFieldChange = (field: keyof LoginInfo, value: string) => {
    setFormError((prev) => ({ ...prev, [field]: "" }));
    setLoginInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleLoginSendCode = () => {
    const errors = validateLoginForm(loginInfo);

    if (errors.identifier || errors.password) {
      setFormError({
        identifier: errors.identifier || "",
        password: errors.password || "",
      });
      return;
    }

    setFormError({ identifier: "", password: "" });

    const value = loginInfo.identifier.trim();
    const isEmail = value.includes("@");

    loginUser(
      isEmail ? { email: value, password: loginInfo.password } : { phone: value, password: loginInfo.password },
    );
  };

  return {
    loginInfo,
    formError,
    loading,
    joinInfo,
    handleFieldChange,
    handleLoginSendCode,
  };
};

export default useLoginForm;
