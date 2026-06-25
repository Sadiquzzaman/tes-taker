import { useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";
import { validateChangePassword } from "@/utils/auth/validation";

const INITIAL_FORM = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

const INITIAL_ERRORS = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export const useChangePasswordForm = () => {
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState(INITIAL_ERRORS);
  const [loading, setLoading] = useState(false);

  const handleFieldChange = (field: keyof typeof INITIAL_FORM, value: string) => {
    setFormError((prev) => ({ ...prev, [field]: "" }));
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async () => {
    const errors = validateChangePassword(form.current_password, form.new_password, form.confirm_password);

    setFormError({
      current_password: errors.current_password || "",
      new_password: errors.new_password || "",
      confirm_password: errors.confirm_password || "",
    });

    if (errors.current_password || errors.new_password || errors.confirm_password) {
      return;
    }

    setLoading(true);
    try {
      await axiosReq.post(`${process.env.NEXT_PUBLIC_BASE_URL}/auth/change-password`, form);

      triggerToast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
        type: "success",
      });

      setForm(INITIAL_FORM);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  };

  return {
    form,
    formError,
    loading,
    handleFieldChange,
    handleChangePassword,
  };
};

export default useChangePasswordForm;
