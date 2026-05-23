import { useState } from "react";
import EyeClosedIconSVG from "@/component/svg/EyeClosedIconSVG";
import EyeOpenIconSVG from "@/component/svg/EyeOpenIconSVG";

const AuthInput = ({ value, onChange, formError, placeholder, label, type = "text" }: AuthInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[#0F1A12] font-medium text-[16px]">{label}</label>
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
            ${formError ? "ring-2 ring-red-500" : "border border-gray-300 focus:ring-2 focus:ring-green-500"}`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeClosedIconSVG /> : <EyeOpenIconSVG />}
          </button>
        )}
      </div>
      {formError && (
        <p className="font-normal text-[16px] leading-[125%] tracking-[-0.02em] text-[#D24B44] align-middle">
          {formError}
        </p>
      )}
    </div>
  );
};

export default AuthInput;
