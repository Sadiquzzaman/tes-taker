"use client";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
};

const Switch = ({ checked, onChange, disabled = false, id, label }: SwitchProps) => {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
          checked ? "bg-[#49734F]" : "bg-[#747775]/40"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      {label && (
        <span className="text-sm text-[#232A25]" style={{ fontFamily: "Instrument Sans, sans-serif" }}>
          {label}
        </span>
      )}
    </label>
  );
};

export default Switch;
