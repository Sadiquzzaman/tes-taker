"use client";

import Link from "next/link";
import useSignUpForm from "@/hooks/auth/useSignUpForm";
import SignUpInfoForm from "./SignUpInfoForm";
import VerifyCode from "./VerifyCode";

const SignUpForm = () => {
  const { joinInfo, view, signUpInfo, formError, checkboxError, loading, handleFieldChange, handleSignUp } =
    useSignUpForm();

  return (
    <>
      {joinInfo?.id && (
        <h4 className="mb-8 text-center text-[16px] font-semibold text-[#49734F] leading-[19px] tracking-[-0.02em] capitalize">
          {joinInfo.headerText}
        </h4>
      )}
      {view === "signup" ? (
        <SignUpInfoForm
          signUpInfo={signUpInfo}
          formError={formError}
          checkboxError={checkboxError}
          loading={loading}
          handleFieldChange={handleFieldChange}
          handleSignUp={handleSignUp}
        />
      ) : (
        <VerifyCode value={signUpInfo.phone} />
      )}
      <p className="mt-4 text-center text-[#747775] text-[16px]">
        Already have an account?{" "}
        <Link href={"/login"} className="text-[#232A25] font-medium underline">
          Log In
        </Link>
      </p>
    </>
  );
};

export default SignUpForm;
