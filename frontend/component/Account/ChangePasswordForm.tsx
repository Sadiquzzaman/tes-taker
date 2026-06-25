"use client";

import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";
import useChangePasswordForm from "@/hooks/auth/useChangePasswordForm";

const ChangePasswordForm = () => {
  const { form, formError, loading, handleFieldChange, handleChangePassword } = useChangePasswordForm();

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white">
      <div className="border-b border-[#E5E5E5] p-6">
        <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.02em] text-[#232A25]">Change password</p>
        <p className="mt-1 text-[14px] font-[400] leading-[18px] tracking-[-0.02em] text-[#747775]">
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
            className="px-5 h-10 flex items-center justify-center rounded-[8px] bg-[#49734F] text-white text-[14px] font-[500] tracking-[-0.02em] transition hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
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
