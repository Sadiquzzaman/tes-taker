"use client";

import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";
import useChangePasswordForm from "@/hooks/auth/useChangePasswordForm";

const ChangePasswordForm = () => {
  const { form, formError, loading, handleFieldChange, handleChangePassword } = useChangePasswordForm();

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border p-6">
        <p className="text-title-sm font-semibold text-ink">Change password</p>
        <p className="mt-1 text-body-sm font-normal text-ink-muted">
          Update your password by entering your current password and a new one.
        </p>
      </div>

      <div className="flex flex-col gap-4 p-6">
        <AuthInput
          value={form.current_password}
          onChange={(e) => handleFieldChange("current_password", e.target.value)}
          type="password"
          formError={formError.current_password}
          placeholder="Enter current password"
          label="Current password"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AuthInput
            value={form.new_password}
            onChange={(e) => handleFieldChange("new_password", e.target.value)}
            type="password"
            formError={formError.new_password}
            placeholder="Enter new password"
            label="New password"
          />
          <AuthInput
            value={form.confirm_password}
            onChange={(e) => handleFieldChange("confirm_password", e.target.value)}
            type="password"
            formError={formError.confirm_password}
            placeholder="Confirm new password"
            label="Confirm new password"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleChangePassword}
            disabled={loading}
            className="px-5 h-10 flex items-center justify-center rounded-input bg-primary text-ink-inverse text-body-sm font-medium transition hover:bg-primary disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
            {loading ? "Updating..." : "Change password"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordForm;
