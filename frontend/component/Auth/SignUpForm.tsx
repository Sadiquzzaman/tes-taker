"use client";

import { useTranslations } from "next-intl";
import useSignUpForm from "@/hooks/auth/useSignUpForm";
import AuthFooterLink from "./AuthFooterLink";
import SignUpChoice from "./SignUpChoice";
import SignUpInfoForm from "./SignUpInfoForm";
import VerifyCode from "./VerifyCode";

/** Signup: choose the account type, fill in details, then verify the phone number. */
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
      {joinInfo?.id && view !== "choice" ? <p className="text-center text-body font-semibold text-primary">{joinInfo.headerText}</p> : null}
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
          description={signUpInfo.request_teacher ? t("signup.teacherNote") : undefined}
        />
      ) : (
        <VerifyCode value={signUpInfo.phone} successDescription={signUpInfo.request_teacher ? t("signup.teacherPending") : undefined} />
      )}
      <AuthFooterLink text={t("haveAccount")} href="/login" label={t("logIn")} />
    </>
  );
};

export default SignUpForm;
