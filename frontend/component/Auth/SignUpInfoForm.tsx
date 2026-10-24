"use client";

import { useTranslations } from "next-intl";
import { Button, Input, PasswordInput } from "@/design/ui";
import AuthDivider from "./AuthDivider";
import AuthHeading from "./AuthHeading";
import ContinueWithGoogle from "./ContinueWithGoogle";
import TermsCheckbox from "./TermsCheckbox";

/** Student or teacher signup details; the phone number gets a verification code next. */
const SignUpInfoForm = ({
  signUpInfo,
  formError,
  checkboxError,
  loading,
  handleFieldChange,
  handleSignUp,
  onBackToChoice,
  title,
  description,
}: SignUpInfoFormProps) => {
  const t = useTranslations("auth");
  return (
    <>
      <AuthHeading title={title ?? t("signup.studentTitle")} step={1} steps={2}>
        {onBackToChoice ? (
          <button type="button" onClick={onBackToChoice} className="self-start text-body-sm font-medium text-primary underline underline-offset-2">
            {t("backToAccountType")}
          </button>
        ) : null}
        {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
      </AuthHeading>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSignUp();
        }}
      >
        <Input
          label={t("fields.fullName")}
          autoComplete="name"
          placeholder={t("fields.fullNamePlaceholder")}
          value={signUpInfo.full_name}
          error={formError.full_name || undefined}
          onChange={(event) => handleFieldChange("full_name", event.target.value)}
        />
        <Input
          label={t("fields.phone")}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={t("fields.phonePlaceholder")}
          value={signUpInfo.phone}
          error={formError.phone || undefined}
          onChange={(event) => handleFieldChange("phone", event.target.value)}
        />
        <PasswordInput
          label={t("fields.password")}
          autoComplete="new-password"
          placeholder={t("fields.passwordPlaceholder")}
          value={signUpInfo.password}
          error={formError.password || undefined}
          onChange={(event) => handleFieldChange("password", event.target.value)}
        />
        <PasswordInput
          label={t("fields.confirmPassword")}
          autoComplete="new-password"
          placeholder={t("fields.confirmPasswordPlaceholder")}
          value={signUpInfo.confirm_password}
          error={formError.confirm_password || undefined}
          onChange={(event) => handleFieldChange("confirm_password", event.target.value)}
        />
        <Input
          label={t("fields.email")}
          type="email"
          autoComplete="email"
          placeholder={t("fields.emailPlaceholder")}
          value={signUpInfo.email || ""}
          error={formError.email || undefined}
          onChange={(event) => handleFieldChange("email", event.target.value)}
        />
        <TermsCheckbox checked={signUpInfo.agreed} error={checkboxError || undefined} onChange={(checked) => handleFieldChange("agreed", checked)} />
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t("signUp")}
        </Button>
      </form>
      <AuthDivider />
      <ContinueWithGoogle />
    </>
  );
};

export default SignUpInfoForm;
