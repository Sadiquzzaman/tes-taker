"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DropDownComponent = ({
  value,
  handleChange,
  list,
  placeholder,
  isSearchable = false,
  maxVisibleOptions,
}: {
  value: string;
  handleChange: (value: string) => void;
  list: { label: string; value: string }[];
  placeholder: string;
  isSearchable?: boolean;
  maxVisibleOptions?: number;
}) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = list.find((item) => item.value === value);
  const filteredList = useMemo(() => {
    if (!isSearchable) {
      return typeof maxVisibleOptions === "number" ? list.slice(0, maxVisibleOptions) : list;
    }

    const normalizedSearchText = searchText.trim().toLowerCase();

    if (!normalizedSearchText) {
      return typeof maxVisibleOptions === "number" ? list.slice(0, maxVisibleOptions) : list;
    }

    const nextList = list.filter((item) => item.label.toLowerCase().includes(normalizedSearchText));

    return typeof maxVisibleOptions === "number" ? nextList.slice(0, maxVisibleOptions) : nextList;
  }, [isSearchable, list, maxVisibleOptions, searchText]);

  useEffect(() => {
    if (!isSearchable) {
      return;
    }

    setSearchText(selected?.label ?? "");
  }, [isSearchable, selected?.label]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (isSearchable) {
          setSearchText(selected?.label ?? "");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchable, selected?.label]);

  return (
    <div ref={containerRef} className="relative">
      {isSearchable ? (
        <div className="flex h-[44px] items-center justify-between rounded-[8px] border border-[#E5E5E5] px-3">
          <input
            type="text"
            value={searchText}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setSearchText(event.target.value);
              if (!open) {
                setOpen(true);
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-[16px] leading-[125%] tracking-[-0.02em] text-[#232A25] placeholder:text-[#747775] focus:outline-none"
          />
          <button type="button" onClick={() => setOpen((prev) => !prev)} className="ml-2 text-[#232A25]">
            {open ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path
                  fillRule="evenodd"
                  d="M11.47 7.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path
                  fillRule="evenodd"
                  d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      ) : (
        <div
          onClick={() => setOpen(!open)}
          className="flex h-[44px] cursor-pointer items-center justify-between rounded-[8px] border border-[#E5E5E5] px-3"
        >
          <span className={`${!value ? "text-[#747775]" : "text-black"}`}>
            {selected ? selected.label : placeholder}
          </span>
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
      )}

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0px_10px_20px_0px_#0A08411A]">
          {filteredList.length > 0 ? (
            filteredList.map((item) => (
              <div
                key={item.value}
                onClick={() => {
                  handleChange(item.value);
                  setSearchText(item.label);
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
            ))
          ) : (
            <div className="px-3 py-2 text-[14px] text-[#747775]">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DropDownComponent;
