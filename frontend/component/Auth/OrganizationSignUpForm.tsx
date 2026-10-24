"use client";

import { useTranslations } from "next-intl";
import { Button, Input, Link, PasswordInput } from "@/design/ui";
import useOrganizationSignUpForm from "@/hooks/auth/useOrganizationSignUpForm";
import AuthFooterLink from "./AuthFooterLink";
import AuthHeading from "./AuthHeading";
import TermsCheckbox from "./TermsCheckbox";
import VerifyCode from "./VerifyCode";

/** Register a school or organisation; the owner's phone gets a verification code next. */
const OrganizationSignUpForm = () => {
  const { view, form, formError, checkboxError, loading, handleFieldChange, handleSignUp } = useOrganizationSignUpForm();
  const t = useTranslations("auth");
  const footer = <AuthFooterLink text={t("haveAccount")} href="/login" label={t("logIn")} />;

  if (view === "otp") {
    return (
      <>
        <VerifyCode
          value={form.phone}
          successTitle={t("signup.organizationRegistered")}
          successDescription={t("signup.organizationRegisteredDescription")}
        />
        {footer}
      </>
    );
  }

  return (
    <>
      <AuthHeading title={t("signup.organizationTitle")} step={1} steps={2}>
        <Link href="/signup" className="self-start text-body-sm font-medium">
          {t("backToAccountType")}
        </Link>
      </AuthHeading>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSignUp();
        }}
      >
        <Input
          label={t("fields.organizationName")}
          autoComplete="organization"
          placeholder={t("fields.organizationNamePlaceholder")}
          value={form.organization_name}
          error={formError.organization_name || undefined}
          onChange={(event) => handleFieldChange("organization_name", event.target.value)}
        />
        <Input
          label={t("fields.ownerFullName")}
          autoComplete="name"
          placeholder={t("fields.fullNamePlaceholder")}
          value={form.full_name}
          error={formError.full_name || undefined}
          onChange={(event) => handleFieldChange("full_name", event.target.value)}
        />
        <Input
          label={t("fields.phone")}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={t("fields.phonePlaceholder")}
          value={form.phone}
          error={formError.phone || undefined}
          onChange={(event) => handleFieldChange("phone", event.target.value)}
        />
        <PasswordInput
          label={t("fields.password")}
          autoComplete="new-password"
          placeholder={t("fields.passwordPlaceholder")}
          value={form.password}
          error={formError.password || undefined}
          onChange={(event) => handleFieldChange("password", event.target.value)}
        />
        <PasswordInput
          label={t("fields.confirmPassword")}
          autoComplete="new-password"
          placeholder={t("fields.confirmPasswordPlaceholder")}
          value={form.confirm_password}
          error={formError.confirm_password || undefined}
          onChange={(event) => handleFieldChange("confirm_password", event.target.value)}
        />
        <Input
          label={t("fields.email")}
          type="email"
          autoComplete="email"
          placeholder={t("fields.emailPlaceholder")}
          value={form.email || ""}
          error={formError.email || undefined}
          onChange={(event) => handleFieldChange("email", event.target.value)}
        />
        <TermsCheckbox checked={form.agreed} error={checkboxError || undefined} onChange={(checked) => handleFieldChange("agreed", checked)} />
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t("signUp")}
        </Button>
      </form>
      {footer}
    </>
  );
};

export default OrganizationSignUpForm;
