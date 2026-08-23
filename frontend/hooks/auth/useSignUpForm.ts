import { useState } from "react";
import { UserRoleEnum } from "@/utils/enum";
import useRegister from "@/hooks/api/useRegister";
import useJoinStateManage from "@/hooks/ui/useJoinStateManage";
import { validateSignUpForm } from "@/utils/auth/validation";

const hasJoinSession = () => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return Boolean(sessionStorage.getItem("joinSessionInfo"));
  } catch {
    return false;
  }
};

export const useSignUpForm = () => {
  const { joinInfo } = useJoinStateManage("signup");
  const [view, setView] = useState<SignUpPageView>(hasJoinSession() ? "signup" : "choice");
  const [signUpInfo, setSignUpInfo] = useState<SignUpInfo>({
    full_name: "",
    email: "",
    agreed: false,
    phone: "",
    password: "",
    confirm_password: "",
    role: UserRoleEnum.STUDENT,
    request_teacher: false,
  });

  const [register, { loading }] = useRegister();
  const [formError, setFormError] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [checkboxError, setCheckboxError] = useState("");

  const handleFieldChange = <K extends keyof SignUpInfo>(field: K, value: SignUpInfo[K]) => {
    if (field === "agreed") {
      setCheckboxError("");
    } else if (field !== "role" && field !== "request_teacher") {
      setFormError((prev) => ({ ...prev, [field]: "" }));
    }
    setSignUpInfo((prev) => ({ ...prev, [field]: value }));
  };

  const startStudentSignup = () => {
    setSignUpInfo((prev) => ({ ...prev, request_teacher: false, role: UserRoleEnum.STUDENT }));
    setView("signup");
  };

  const startTeacherSignup = () => {
    setSignUpInfo((prev) => ({ ...prev, request_teacher: true, role: UserRoleEnum.STUDENT }));
    setView("signup");
  };

  const handleSignUp = () => {
    const errors = validateSignUpForm(signUpInfo);

    setFormError({
      full_name: errors.full_name || "",
      email: errors.email || "",
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
    startStudentSignup,
    startTeacherSignup,
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
