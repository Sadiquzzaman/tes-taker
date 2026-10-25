"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, MutableRefObject } from "react";
import { cn, focusRing } from "@/design/ui";

/** The six one-digit boxes of a verification code. Typing moves to the next box; Backspace moves back. */
const OtpInput = ({
  otp,
  error,
  inputsRef,
  onChange,
  onKeyDown,
}: {
  otp: string[];
  error?: string;
  inputsRef: MutableRefObject<(HTMLInputElement | null)[]>;
  onChange: (index: number, value: string, previous: string) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
}) => {
  const t = useTranslations("auth.otp");
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? "otp-error" : undefined}>
      <legend className="sr-only">{t("code")}</legend>
      <div className="flex justify-between gap-2">
        {otp.map((value, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={t("digit", { number: index + 1, total: otp.length })}
            aria-invalid={error ? true : undefined}
            value={value}
            onChange={(event) => onChange(index, event.target.value, value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            className={cn(
              "h-14 w-11 rounded-input border bg-surface text-center text-title-sm font-medium text-ink sm:w-12",
              error ? "border-danger" : "border-border",
              focusRing,
            )}
          />
        ))}
      </div>
      {error ? (
        <p id="otp-error" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};

export default OtpInput;
