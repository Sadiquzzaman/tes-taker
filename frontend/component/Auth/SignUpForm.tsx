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
        <h4 className="mb-8 text-center text-body font-semibold text-primary capitalize">
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
      <p className="mt-4 text-center text-ink-muted text-body">
        {t("haveAccount")}{" "}
        <Link href={"/login"} className="text-ink font-medium underline">
          {t("logIn")}
        </Link>
      </p>
    </>
  );
};

export default SignUpForm;
