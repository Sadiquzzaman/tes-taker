import { useTranslations } from "next-intl";

/** "or" between the form and Continue with Google. */
const AuthDivider = () => {
  const t = useTranslations("auth");
  return (
    <div className="flex items-center gap-4" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-body-sm text-ink-muted">{t("or")}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
};

export default AuthDivider;
