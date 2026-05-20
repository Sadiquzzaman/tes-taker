import { useState, useEffect } from "react";
import { UserRoleEnum } from "@/utils/enum";
import useRegister from "@/hooks/api/useRegister";
import useJoinStateManage from "@/hooks/ui/useJoinStateManage";
import { validateSignUpForm } from "@/utils/auth/validation";

export const useSignUpForm = () => {
  const { joinInfo } = useJoinStateManage("signup");
  const [view, setView] = useState<SignUpPageView>("signup");
  const [signUpInfo, setSignUpInfo] = useState<SignUpInfo>({
    full_name: "",
    email: "",
    organization: "",
    agreed: false,
    phone: "",
    password: "",
    confirm_password: "",
    role: UserRoleEnum.TEACHER,
  });

  const [register, { loading }] = useRegister();
  const [formError, setFormError] = useState({
    full_name: "",
    email: "",
    organization: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [checkboxError, setCheckboxError] = useState("");

  useEffect(() => {
    if (joinInfo?.id) {
      setSignUpInfo((prev) => ({
        ...prev,
        role: UserRoleEnum.STUDENT,
      }));
    } else {
      setSignUpInfo((prev) => ({
        ...prev,
        role: UserRoleEnum.TEACHER,
      }));
    }
  }, [joinInfo]);

  const handleFieldChange = <K extends keyof SignUpInfo>(field: K, value: SignUpInfo[K]) => {
    if (field === "agreed") {
      setCheckboxError("");
    } else if (field !== "role") {
      setFormError((prev) => ({ ...prev, [field]: "" }));
    }
    setSignUpInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignUp = () => {
    const errors = validateSignUpForm(signUpInfo);

    setFormError({
      full_name: errors.full_name || "",
      email: errors.email || "",
      organization: "",
      phone: errors.phone || "",
      password: errors.password || "",
      confirm_password: errors.confirm_password || "",
    });

    if (errors.checkboxError) {
      setCheckboxError(errors.checkboxError);
    } else {
      setCheckboxError("");
    }

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      return;
    }

    register(signUpInfo).then((response) => response && setView("otp"));
  };

  return {
    joinInfo,
    view,
    setView,
    signUpInfo,
    setSignUpInfo,
    formError,
    checkboxError,
    loading,
    handleFieldChange,
    handleSignUp,
  };
};

export default useSignUpForm;
