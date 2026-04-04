import { useState } from "react";

const EyeOpen = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const EyeClosed = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3l18 18M9.88 9.88A3 3 0 0012 15a3 3 0 002.12-5.12M6.53 6.53C4.06 8.36 2.25 12 2.25 12s3.75 7.5 9.75 7.5c2.13 0 4.09-.54 5.72-1.47M17.47 17.47C19.94 15.64 21.75 12 21.75 12s-3.75-7.5-9.75-7.5c-2.13 0-4.09.54-5.72 1.47"
    />
  </svg>
);

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
            {showPassword ? <EyeClosed /> : <EyeOpen />}
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
