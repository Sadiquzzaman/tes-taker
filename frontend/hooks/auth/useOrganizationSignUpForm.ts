import { useTranslations } from "next-intl";
import { useState } from "react";
import { AxiosError } from "axios";
import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { validateOrganizationSignUpForm } from "@/utils/auth/validation";

export const useOrganizationSignUpForm = () => {
  const { triggerToast } = useToast();
  const t = useTranslations("auth.signup");
  const tv = useTranslations("validation");
  const [view, setView] = useState<"signup" | "otp">("signup");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<OrganizationRegisterInfo>({
    organization_name: "",
    full_name: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: "",
    agreed: false,
  });
  const [formError, setFormError] = useState({
    organization_name: "",
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [checkboxError, setCheckboxError] = useState("");

  const handleFieldChange = <K extends keyof OrganizationRegisterInfo>(
    field: K,
    value: OrganizationRegisterInfo[K],
  ) => {
    if (field === "agreed") {
      setCheckboxError("");
    } else {
      setFormError((prev) => ({ ...prev, [field]: "" }));
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignUp = async () => {
    const errors = validateOrganizationSignUpForm(form, tv);

    setFormError({
      organization_name: errors.organization_name || "",
      full_name: errors.full_name || "",
      email: errors.email || "",
      phone: errors.phone || "",
      password: errors.password || "",
      confirm_password: errors.confirm_password || "",
    });
    setCheckboxError(errors.checkboxError || "");

    if (Object.keys(errors).length > 0) {
      return;
    }

    const requestData: Record<string, string> = {
      organization_name: form.organization_name.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone,
      email: form.email.trim(),
      password: form.password,
      confirm_password: form.confirm_password,
    };

    setLoading(true);
    try {
      await axiosReq.post(`${process.env.NEXT_PUBLIC_BASE_URL}/auth/register/organization`, requestData);
      triggerToast({
        title: t("otpSentTitle"),
        description: t("otpSentDescription"),
        type: "success",
      });
      setView("otp");
    } catch (caught) {
      const error = caught as AxiosError<{ message?: unknown }>;
      const message = error.response?.data?.message;
      triggerToast({
        title: t("failedTitle"),
        description: typeof message === "string" && message ? message : t("organizationFailed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    view,
    form,
    formError,
    checkboxError,
    loading,
    handleFieldChange,
    handleSignUp,
  };
};

export default useOrganizationSignUpForm;
