"use client";

import { useState } from "react";
import ContinueWithGoogle from "./continueWithGoogle";
import useLogin from "@/hooks/api/useLogin";
import Link from "next/link";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";

const LoginForm = () => {
  const [loginInfo, setLoginInfo] = useState<LoginInfo>({
    identifier: "",
    password: "",
  });
  const [loginUser, { loading }] = useLogin();
  const [formError, setFormError] = useState({
    identifier: "",
    password: "",
  });

  const handleLoginSendCode = () => {
    const value = loginInfo.identifier.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const bdPhoneRegex = /^01[3-9]\d{8}$/;
    const isEmail = value.includes("@");
    const isPhone = /^\d+$/.test(value);

    if (!value) {
      setFormError({ ...formError, identifier: "Please enter email or phone number" });
    } else if (isPhone && value.length !== 11) {
      setFormError({ ...formError, identifier: "Phone number must be 11 digits" });
    } else if (isPhone && !bdPhoneRegex.test(value)) {
      setFormError({ ...formError, identifier: "Invalid Bangladeshi phone number" });
    } else if (isEmail && !emailRegex.test(value)) {
      setFormError({ ...formError, identifier: "Invalid email address" });
    } else if (!isEmail && !isPhone) {
      setFormError({ ...formError, identifier: "Enter a valid email or phone number" });
    } else if (!loginInfo.password) {
      setFormError({ ...formError, password: "Please enter a password" });
    } else if (loginInfo.password.length < 8) {
      setFormError({ ...formError, password: "Password must be at least 8 characters." });
    } else {
      setFormError({ ...formError, password: "", identifier: "" });
      loginUser(
        isEmail
          ? { email: value, password: loginInfo.password }
          : { phone: value, password: loginInfo.password },
      );
    }
  };

  return (
    <>
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
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
            onChange={(e) => {
              setFormError({ ...formError, identifier: "" });
              setLoginInfo({ ...loginInfo, identifier: e.target.value });
            }}
            formError={formError.identifier}
            placeholder="Enter email or phone"
            label="Email or phone"
          />
          <AuthInput
            value={loginInfo.password}
            onChange={(e) => {
              setFormError({ ...formError, password: "" });
              setLoginInfo({ ...loginInfo, password: e.target.value });
            }}
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
            {loading ? "Sending..." : "Send Code"}
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
