"use client";

import { useState } from "react";
import ContinueWithGoogle from "./continueWithGoogle";
import useLogin from "@/hooks/api/useLogin";
import Link from "next/link";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";

const LoginForm = () => {
  const [loginInfo, setLoginInfo] = useState<LoginInfo>({
    phone: "",
    password: "",
  });
  const [loginUser, { loading }] = useLogin();
  const [formError, setFormError] = useState({
    phone: "",
    password: "",
  });
  const handleLoginSendCode = () => {
    const value = loginInfo.phone.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const bdPhoneRegex = /^01[3-9]\d{8}$/;

    if (!value) {
      setFormError({ ...formError, phone: "Please enter email or phone number" });
    } else if (!value.includes("@") && !/^\d+$/.test(value)) {
      setFormError({ ...formError, phone: "Enter a valid email or phone number" });
    } else if (value.includes("@") && !emailRegex.test(value)) {
      setFormError({ ...formError, phone: "Invalid email address" });
    } else if (/^\d+$/.test(value) && !bdPhoneRegex.test(value)) {
      setFormError({ ...formError, phone: "Invalid Bangladeshi phone number (11 digits required)" });
    } else if (!loginInfo.password) {
      setFormError({ ...formError, password: "Please enter a password" });
    } else if (loginInfo.password.length < 8) {
      setFormError({ ...formError, password: "Password must be at least 8 characters." });
    } else {
      setFormError({ ...formError, password: "", phone: "" });
      loginUser({ phone: value, password: loginInfo.password });
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
            value={loginInfo.phone}
            onChange={(e) => {
              setFormError({ ...formError, phone: "" });
              setLoginInfo({ ...loginInfo, phone: e.target.value });
            }}
            formError={formError.phone}
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
