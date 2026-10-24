import { useTranslations } from "next-intl";
import AuthInput from "@/Ui/AuthInput";
import ContinueWithGoogle from "./ContinueWithGoogle";
import ButtonLoader from "../Loader/ButtonLoadder";

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
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
      <div className="flex flex-row justify-between items-center mb-2">
        <h2 className="text-display font-semibold text-ink capitalize">
          {title ?? t("signup.studentTitle")}
        </h2>
        <div className="flex gap-0.5 ml-2">
          <div className="w-4 h-1 rounded-sm bg-primary" />
          <div className="w-4 h-1 rounded-sm bg-border" />
        </div>
      </div>
      {onBackToChoice && (
        <button
          type="button"
          onClick={onBackToChoice}
          className="text-left text-primary text-body-sm font-medium underline -mt-4"
        >
          {t("backToAccountType")}
        </button>
      )}
      {description && (
        <p className="text-ink-muted text-body-sm -mt-4">{description}</p>
      )}
      <div className="flex flex-col gap-3">
        <AuthInput
          value={signUpInfo.full_name}
          onChange={(e) => handleFieldChange("full_name", e.target.value)}
          formError={formError.full_name}
          placeholder={t("fields.fullNamePlaceholder")}
          label={t("fields.fullName")}
        />
        <AuthInput
          value={signUpInfo.phone}
          onChange={(e) => handleFieldChange("phone", e.target.value)}
          type="number"
          formError={formError.phone}
          placeholder={t("fields.phonePlaceholder")}
          label={t("fields.phone")}
        />
        <AuthInput
          value={signUpInfo.password}
          onChange={(e) => handleFieldChange("password", e.target.value)}
          type="password"
          formError={formError.password}
          placeholder={t("fields.passwordPlaceholder")}
          label={t("fields.password")}
        />
        <AuthInput
          value={signUpInfo.confirm_password}
          onChange={(e) => handleFieldChange("confirm_password", e.target.value)}
          type="password"
          formError={formError.confirm_password}
          placeholder={t("fields.confirmPasswordPlaceholder")}
          label={t("fields.confirmPassword")}
        />
        <AuthInput
          value={signUpInfo.email || ""}
          onChange={(e) => handleFieldChange("email", e.target.value)}
          formError={formError.email}
          placeholder={t("fields.emailPlaceholder")}
          label={t("fields.email")}
        />

        <div className="flex flex-row items-center gap-2 py-2">
          <input
            id="terms"
            type="checkbox"
            checked={signUpInfo.agreed}
            onChange={(e) => handleFieldChange("agreed", e.target.checked)}
            className="w-5 h-5 accent-primary border border-border rounded focus:ring-2 focus:ring-primary"
          />
          <label htmlFor="terms" className="text-ink-muted font-regular text-body">
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
          onClick={handleSignUp}
          className="w-full mt-4 bg-primary text-ink-inverse py-3 rounded-lg font-medium mb-4 hover:bg-primary transition flex items-center justify-center gap-2 disabled:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-ink-muted"
          disabled={loading}
        >
          <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
          {loading ? t("signingUp") : t("signUp")}
        </button>
      </div>

      <div className="flex flex-row items-center gap-5 my-0">
        <hr className="flex-grow border-border" />
        <span className="text-ink-muted text-body-sm">{t("or")}</span>
        <hr className="flex-grow border-border" />
      </div>
      <ContinueWithGoogle />
    </div>
  );
};

export default SignUpInfoForm;
