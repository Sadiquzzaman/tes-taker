"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/design/ui";

/** "I agree to the terms and privacy policy", required before signing up. */
const TermsCheckbox = ({ checked, error, onChange }: { checked: boolean; error?: string; onChange: (checked: boolean) => void }) => {
  const t = useTranslations("auth");
  return (
    <div className="flex flex-col gap-1">
      <Checkbox
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-invalid={error ? true : undefined}
        label={t.rich("agreeTerms", {
          terms: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
          privacy: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
        })}
      />
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
};

export default TermsCheckbox;
