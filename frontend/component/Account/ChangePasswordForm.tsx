"use client";

import { useTranslations } from "next-intl";
import { Button, Card, PasswordInput } from "@/design/ui";
import useChangePasswordForm from "@/hooks/auth/useChangePasswordForm";

/** Change the password: the current one, then the new one twice. */
const ChangePasswordForm = () => {
  const t = useTranslations("account.changePassword");
  const { form, formError, loading, handleFieldChange, handleChangePassword } = useChangePasswordForm();

  return (
    <Card title={t("title")} description={t("intro")}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleChangePassword();
        }}
      >
        <PasswordInput
          label={t("current")}
          autoComplete="current-password"
          placeholder={t("currentPlaceholder")}
          value={form.current_password}
          error={formError.current_password || undefined}
          onChange={(event) => handleFieldChange("current_password", event.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordInput
            label={t("new")}
            autoComplete="new-password"
            placeholder={t("newPlaceholder")}
            value={form.new_password}
            error={formError.new_password || undefined}
            onChange={(event) => handleFieldChange("new_password", event.target.value)}
          />
          <PasswordInput
            label={t("confirm")}
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
            value={form.confirm_password}
            error={formError.confirm_password || undefined}
            onChange={(event) => handleFieldChange("confirm_password", event.target.value)}
          />
        </div>
        <Button type="submit" className="self-end" loading={loading}>
          {t("submit")}
        </Button>
      </form>
    </Card>
  );
};

export default ChangePasswordForm;
