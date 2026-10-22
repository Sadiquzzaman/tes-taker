"use client";

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
          title={signUpInfo.request_teacher ? "Teacher Sign Up" : "Student Sign Up"}
          description={
            signUpInfo.request_teacher
              ? "You will register as a student first. After an administrator approves your teacher request, you will receive teacher permissions."
              : undefined
          }
        />
      ) : (
        <VerifyCode
          value={signUpInfo.phone}
          successDescription={
            signUpInfo.request_teacher
              ? "Your teacher request is pending admin approval. You can sign in as a student until it is approved."
              : undefined
          }
        />
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
