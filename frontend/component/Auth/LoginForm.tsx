"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import useLoginForm from "@/hooks/auth/useLoginForm";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "../Loader/ButtonLoadder";
import ContinueWithGoogle from "./ContinueWithGoogle";

const LoginForm = () => {
  const { loginInfo, formError, loading, joinInfo, handleFieldChange, handleSubmit } = useLoginForm();
  const t = useTranslations("auth");

  return (
    <>
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
        {joinInfo?.id && (
          <h4 className="text-center text-body font-semibold text-primary capitalize">
            {joinInfo.headerText}
          </h4>
        )}

        <div className="flex flex-row justify-between items-center mb-2">
          <h2 className="text-display font-semibold text-ink capitalize">
            {t("login.title")}
          </h2>
          <div className="flex gap-0.5 ml-2">
            <div className="w-4 h-1 rounded-sm bg-primary" />
            <div className="w-4 h-1 rounded-sm bg-border" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <AuthInput
            value={loginInfo.identifier}
            onChange={(e) => handleFieldChange("identifier", e.target.value)}
            formError={formError.identifier}
            placeholder={t("fields.emailOrPhonePlaceholder")}
            label={t("fields.emailOrPhone")}
          />

          <AuthInput
            value={loginInfo.password}
            onChange={(e) => handleFieldChange("password", e.target.value)}
            type="password"
            formError={formError.password}
            placeholder={t("fields.passwordPlaceholder")}
            label={t("fields.password")}
          />

          <div className="flex justify-end -mt-2">
            <Link href="/forgot-password" className="text-primary text-body-sm font-medium underline">
              {t("login.forgotPassword")}
            </Link>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full mt-4 bg-primary text-ink-inverse py-3 rounded-lg font-medium mb-4 hover:bg-primary transition flex items-center justify-center gap-2 disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-muted"
            disabled={loading}
          >
            <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </div>

        <div className="flex flex-row items-center gap-5 my-2">
          <hr className="flex-grow border-border" />
          <span className="text-ink-muted text-body-sm">{t("or")}</span>
          <hr className="flex-grow border-border" />
        </div>
        <ContinueWithGoogle />
      </div>

      <p className="mt-10 text-center text-ink-muted text-body">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-ink font-medium underline">
          {t("signUp")}
        </Link>
      </p>
    </>
  );
};

export default LoginForm;
