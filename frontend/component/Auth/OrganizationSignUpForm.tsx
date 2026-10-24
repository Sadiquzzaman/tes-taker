"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import AuthInput from "@/Ui/AuthInput";
import ButtonLoader from "@/component/Loader/ButtonLoadder";
import VerifyCode from "@/component/Auth/VerifyCode";
import useOrganizationSignUpForm from "@/hooks/auth/useOrganizationSignUpForm";

const OrganizationSignUpForm = () => {
  const { view, form, formError, checkboxError, loading, handleFieldChange, handleSignUp } =
    useOrganizationSignUpForm();
  const t = useTranslations("auth");

  if (view === "otp") {
    return (
      <>
        <VerifyCode
          value={form.phone}
          successTitle={t("signup.organizationRegistered")}
          successDescription={t("signup.organizationRegisteredDescription")}
        />
        <p className="mt-4 text-center text-ink-muted text-body">
          {t("haveAccount")}{" "}
          <Link href={"/login"} className="text-ink font-medium underline">
            {t("logIn")}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
        <div className="flex flex-row justify-between items-center mb-2">
          <h2 className="text-display font-semibold text-ink capitalize">
            {t("signup.organizationTitle")}
          </h2>
          <div className="flex gap-0.5 ml-2">
            <div className="w-4 h-1 rounded-sm bg-primary" />
            <div className="w-4 h-1 rounded-sm bg-border" />
          </div>
        </div>

        <Link href="/signup" className="text-primary text-body-sm font-medium underline -mt-4">
          {t("backToAccountType")}
        </Link>

        <div className="flex flex-col gap-3">
          <AuthInput
            value={form.organization_name}
            onChange={(e) => handleFieldChange("organization_name", e.target.value)}
            formError={formError.organization_name}
            placeholder={t("fields.organizationNamePlaceholder")}
            label={t("fields.organizationName")}
          />
          <AuthInput
            value={form.full_name}
            onChange={(e) => handleFieldChange("full_name", e.target.value)}
            formError={formError.full_name}
            placeholder={t("fields.fullNamePlaceholder")}
            label={t("fields.ownerFullName")}
          />
          <AuthInput
            value={form.phone}
            onChange={(e) => handleFieldChange("phone", e.target.value)}
            type="number"
            formError={formError.phone}
            placeholder={t("fields.phonePlaceholder")}
            label={t("fields.phone")}
          />
          <AuthInput
            value={form.password}
            onChange={(e) => handleFieldChange("password", e.target.value)}
            type="password"
            formError={formError.password}
            placeholder={t("fields.passwordPlaceholder")}
            label={t("fields.password")}
          />
          <AuthInput
            value={form.confirm_password}
            onChange={(e) => handleFieldChange("confirm_password", e.target.value)}
            type="password"
            formError={formError.confirm_password}
            placeholder={t("fields.confirmPasswordPlaceholder")}
            label={t("fields.confirmPassword")}
          />
          <AuthInput
            value={form.email || ""}
            onChange={(e) => handleFieldChange("email", e.target.value)}
            formError={formError.email}
            placeholder={t("fields.emailPlaceholder")}
            label={t("fields.email")}
          />

          <div className="flex flex-row items-center gap-2 py-2">
            <input
              id="org-terms"
              type="checkbox"
              checked={form.agreed}
              onChange={(e) => handleFieldChange("agreed", e.target.checked)}
              className="w-5 h-5 accent-primary border border-border rounded focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="org-terms" className="text-ink-muted font-regular text-body">
              {t.rich("agreeTerms", {
                terms: (chunks) => (
                  <a href="#" className="underline font-medium">
                    {chunks}
                  </a>
                ),
                privacy: (chunks) => (
                  <a href="#" className="underline font-medium">
                    {chunks}
                  </a>
                ),
              })}
            </label>
          </div>

          {checkboxError && (
            <p className="font-normal text-body text-danger align-middle">
              {checkboxError}
            </p>
          )}

          <button
            onClick={() => void handleSignUp()}
            className="w-full mt-4 bg-primary text-ink-inverse py-3 rounded-lg font-medium mb-4 hover:bg-primary transition flex items-center justify-center gap-2 disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-muted"
            disabled={loading}
          >
            <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
            {loading ? t("signingUp") : t("signUp")}
          </button>
        </div>
      </div>
      <p className="mt-4 text-center text-ink-muted text-body">
        {t("haveAccount")}{" "}
        <Link href={"/login"} className="text-ink font-medium underline">
          {t("logIn")}
        </Link>
      </p>
    </>
  );
};

export default OrganizationSignUpForm;
