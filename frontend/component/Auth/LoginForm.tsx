"use client";

import { useTranslations } from "next-intl";
import { Button, Input, Link, PasswordInput } from "@/design/ui";
import useLoginForm from "@/hooks/auth/useLoginForm";
import AuthDivider from "./AuthDivider";
import AuthFooterLink from "./AuthFooterLink";
import AuthHeading from "./AuthHeading";
import ContinueWithGoogle from "./ContinueWithGoogle";

/** Log in with email or phone and password, or with Google. */
const LoginForm = () => {
  const { loginInfo, formError, loading, joinInfo, handleFieldChange, handleSubmit } = useLoginForm();
  const t = useTranslations("auth");

  return (
    <>
      {joinInfo?.id ? <p className="text-center text-body font-semibold text-primary">{joinInfo.headerText}</p> : null}
      <AuthHeading title={t("login.title")} />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <Input
          label={t("fields.emailOrPhone")}
          autoComplete="username"
          placeholder={t("fields.emailOrPhonePlaceholder")}
          value={loginInfo.identifier}
          error={formError.identifier || undefined}
          onChange={(event) => handleFieldChange("identifier", event.target.value)}
        />
        <PasswordInput
          label={t("fields.password")}
          autoComplete="current-password"
          placeholder={t("fields.passwordPlaceholder")}
          value={loginInfo.password}
          error={formError.password || undefined}
          onChange={(event) => handleFieldChange("password", event.target.value)}
        />
        <Link href="/forgot-password" className="self-end text-body-sm font-medium">
          {t("login.forgotPassword")}
        </Link>
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t("login.submit")}
        </Button>
      </form>
      <AuthDivider />
      <ContinueWithGoogle />
      <AuthFooterLink text={t("noAccount")} href="/signup" label={t("signUp")} />
    </>
  );
};

export default LoginForm;
