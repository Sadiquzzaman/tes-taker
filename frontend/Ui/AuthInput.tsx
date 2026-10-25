import { useTranslations } from "next-intl";
import { useState } from "react";
import EyeClosedIconSVG from "@/component/svg/EyeClosedIconSVG";
import EyeOpenIconSVG from "@/component/svg/EyeOpenIconSVG";

const AuthInput = ({ value, onChange, formError, placeholder, label, type = "text" }: AuthInputProps) => {
  const t = useTranslations("auth");
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex flex-col gap-2">
      <label className="text-ink font-medium text-body">{label}</label>
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          value={value || ""}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full mb-1 px-4 py-3 pr-10 rounded-lg focus:outline-none 
            [appearance:textfield] 
            [&::-webkit-outer-spin-button]:appearance-none 
            [&::-webkit-inner-spin-button]:appearance-none
            ${formError ? "ring-2 ring-danger" : "border border-border focus:ring-2 focus:ring-primary"}`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
          >
            {showPassword ? <EyeClosedIconSVG /> : <EyeOpenIconSVG />}
          </button>
        )}
      </div>
      {formError && (
        <p className="font-normal text-body text-danger align-middle">
          {formError}
        </p>
      )}
    </div>
  );
};

export default AuthInput;
