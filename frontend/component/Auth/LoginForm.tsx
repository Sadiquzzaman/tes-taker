"use client";

import Link from "next/link";
import useLoginForm from "@/hooks/auth/useLoginForm";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";
import ContinueWithGoogle from "./ContinueWithGoogle";

const LoginForm = () => {
  const { loginInfo, formError, loading, joinInfo, handleFieldChange, handleLoginSendCode } = useLoginForm();

  return (
    <>
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
        {joinInfo?.id && (
          <h4 className="text-center text-[16px] font-semibold text-[#49734F] leading-[19px] tracking-[-0.02em] capitalize">
            {joinInfo.headerText}
          </h4>
        )}
        <div className="flex flex-row justify-between items-center mb-2">
          <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
            Login
          </h2>
          <div className="flex gap-0.5 ml-2">
            <div className="w-4 h-1 rounded-[2px] bg-[#49734F]" />
            <div className="w-4 h-1 rounded-[2px] bg-[#E5E5E5]" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <AuthInput
            value={loginInfo.identifier}
            onChange={(e) => handleFieldChange("identifier", e.target.value)}
            formError={formError.identifier}
            placeholder="Enter email or phone"
            label="Email or phone"
          />
          <AuthInput
            value={loginInfo.password}
            onChange={(e) => handleFieldChange("password", e.target.value)}
            type="password"
            formError={formError.password}
            placeholder="Enter password"
            label="Password"
          />
          <button
            onClick={handleLoginSendCode}
            className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium mb-4 hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
            disabled={loading}
          >
            <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>

        <div className="flex flex-row items-center gap-5 my-2">
          <hr className="flex-grow border-[#E5E5E5]" />
          <span className="text-[#747775] text-[14px]">OR</span>
          <hr className="flex-grow border-[#E5E5E5]" />
        </div>
        <ContinueWithGoogle />
      </div>
      <p className="mt-10 text-center text-[#747775] text-[16px]">
        Don't have an account?{" "}
        <Link href={"/signup"} className="text-[#232A25] font-medium underline">
          Sign Up
        </Link>
      </p>
    </>
  );
};

export default LoginForm;
