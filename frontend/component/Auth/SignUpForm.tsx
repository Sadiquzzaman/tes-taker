"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import useSignUpForm from "@/hooks/auth/useSignUpForm";
import SignUpChoice from "./SignUpChoice";
import SignUpInfoForm from "./SignUpInfoForm";
import VerifyCode from "./VerifyCode";

const SignUpForm = () => {
  const {
    joinInfo,
    view,
    setView,
    startStudentSignup,
    startTeacherSignup,
    signUpInfo,
    formError,
    checkboxError,
    loading,
    handleFieldChange,
    handleSignUp,
  } = useSignUpForm();
  const t = useTranslations("auth");

  return (
    <>
      {joinInfo?.id && view !== "choice" && (
        <h4 className="mb-8 text-center text-[16px] font-semibold text-[#49734F] leading-[19px] tracking-[-0.02em] capitalize">
          {joinInfo.headerText}
        </h4>
      )}
      {view === "choice" ? (
        <SignUpChoice onSelectStudent={startStudentSignup} onSelectTeacher={startTeacherSignup} />
      ) : view === "signup" ? (
        <SignUpInfoForm
          signUpInfo={signUpInfo}
          formError={formError}
          checkboxError={checkboxError}
          loading={loading}
          handleFieldChange={handleFieldChange}
          handleSignUp={handleSignUp}
          onBackToChoice={() => setView("choice")}
          title={signUpInfo.request_teacher ? t("signup.teacherTitle") : t("signup.studentTitle")}
          description={
            signUpInfo.request_teacher
              ? t("signup.teacherNote")
              : undefined
          }
        />
      ) : (
        <VerifyCode
          value={signUpInfo.phone}
          successDescription={
            signUpInfo.request_teacher
              ? t("signup.teacherPending")
              : undefined
          }
        />
      )}
      <p className="mt-4 text-center text-[#747775] text-[16px]">
        {t("haveAccount")}{" "}
        <Link href={"/login"} className="text-[#232A25] font-medium underline">
          {t("logIn")}
        </Link>
      </p>
    </>
  );
};

export default SignUpForm;
