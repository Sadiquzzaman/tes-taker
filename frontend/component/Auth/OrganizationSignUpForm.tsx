"use client";

import Link from "next/link";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "@/component/Loader/ButtonLoadder";
import VerifyCode from "@/component/Auth/VerifyCode";
import useOrganizationSignUpForm from "@/hooks/auth/useOrganizationSignUpForm";

const OrganizationSignUpForm = () => {
  const { view, form, formError, checkboxError, loading, handleFieldChange, handleSignUp } =
    useOrganizationSignUpForm();

  if (view === "otp") {
    return (
      <>
        <VerifyCode
          value={form.phone}
          successTitle="Organization registered"
          successDescription="Save your organization number from the confirmation toast. After SUPER_ADMIN approval, sign in with your phone and password."
        />
        <p className="mt-4 text-center text-[#747775] text-[16px]">
          Already have an account?{" "}
          <Link href={"/login"} className="text-[#232A25] font-medium underline">
            Log In
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
        <div className="flex flex-row justify-between items-center mb-2">
          <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
            Organization Sign Up
          </h2>
          <div className="flex gap-0.5 ml-2">
            <div className="w-4 h-1 rounded-[2px] bg-[#49734F]" />
            <div className="w-4 h-1 rounded-[2px] bg-[#E5E5E5]" />
          </div>
        </div>

        <Link href="/signup" className="text-[#49734F] text-[14px] font-medium underline -mt-4">
          Back to account type
        </Link>

        <div className="flex flex-col gap-3">
          <AuthInput
            value={form.organization_name}
            onChange={(e) => handleFieldChange("organization_name", e.target.value)}
            formError={formError.organization_name}
            placeholder="e.g., ABC School"
            label="Organization / school name"
          />
          <AuthInput
            value={form.full_name}
            onChange={(e) => handleFieldChange("full_name", e.target.value)}
            formError={formError.full_name}
            placeholder="e.g., John Doe"
            label="Owner full name"
          />
          <AuthInput
            value={form.phone}
            onChange={(e) => handleFieldChange("phone", e.target.value)}
            type="number"
            formError={formError.phone}
            placeholder="Enter phone number"
            label="Phone"
          />
          <AuthInput
            value={form.password}
            onChange={(e) => handleFieldChange("password", e.target.value)}
            type="password"
            formError={formError.password}
            placeholder="Enter password"
            label="Password"
          />
          <AuthInput
            value={form.confirm_password}
            onChange={(e) => handleFieldChange("confirm_password", e.target.value)}
            type="password"
            formError={formError.confirm_password}
            placeholder="Confirm password"
            label="Confirm Password"
          />
          <AuthInput
            value={form.email || ""}
            onChange={(e) => handleFieldChange("email", e.target.value)}
            formError={formError.email}
            placeholder="Enter email address"
            label="Email (Optional)"
          />

          <div className="flex flex-row items-center gap-2 py-2">
            <input
              id="org-terms"
              type="checkbox"
              checked={form.agreed}
              onChange={(e) => handleFieldChange("agreed", e.target.checked)}
              className="w-5 h-5 accent-[#49734F] border border-[#E5E5E5] rounded focus:ring-2 focus:ring-green-500"
            />
            <label htmlFor="org-terms" className="text-[#747775] font-regular text-[16px]">
              I agree to the{" "}
              <a href="#" className="underline font-medium">
                Terms of Service
              </a>{" "}
              and the{" "}
              <a href="#" className="underline font-medium">
                Privacy Policy
              </a>
              .
            </label>
          </div>

          {checkboxError && (
            <p className="font-normal text-[16px] leading-[125%] tracking-[-0.02em] text-[#D24B44] align-middle">
              {checkboxError}
            </p>
          )}

          <button
            onClick={() => void handleSignUp()}
            className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium mb-4 hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
            disabled={loading}
          >
            <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
            {loading ? "Signing Up..." : "Sign Up"}
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-[#747775] text-[16px]">
        Already have an account?{" "}
        <Link href={"/login"} className="text-[#232A25] font-medium underline">
          Log In
        </Link>
      </p>
    </>
  );
};

export default OrganizationSignUpForm;
