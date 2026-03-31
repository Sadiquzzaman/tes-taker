'use client";';

import { useState } from "react";

const DropDownComponent = ({
  value,
  handleChange,
  list,
  placeholder,
}: {
  value: string;
  handleChange: (value: string) => void;
  list: { label: string; value: string }[];
  placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = list.find((item) => item.value === value);

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(!open)}
        className="flex h-[44px] cursor-pointer items-center justify-between rounded-[8px] border border-[#E5E5E5] px-3"
      >
        <span className={`${!value ? "text-[#747775]" : "text-black"}`}>{selected ? selected.label : placeholder}</span>
        <span>
          {open ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-2 mt-[2px] size-4"
            >
              <path
                fillRule="evenodd"
                d="M11.47 7.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-2 mt-[2px] size-4"
            >
              <path
                fillRule="evenodd"
                d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
      </div>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0px_10px_20px_0px_#0A08411A]">
          {list.map((item) => (
            <div
              key={item.value}
              onClick={() => {
                handleChange(item.value);
                setOpen(false);
              }}
              className={`
                  cursor-pointer px-3 py-2
                  text-[16px] leading-[125%] tracking-[-0.02em] text-[#232A25]
                  hover:bg-[#49734F0D]
                  ${selected?.value === item.value ? "bg-[#49734F0D]" : ""}
                `}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropDownComponent;
