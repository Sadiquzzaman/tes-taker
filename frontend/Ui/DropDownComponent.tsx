"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ChevronDownFilledIconSVG from "@/component/svg/ChevronDownFilledIconSVG";
import ChevronUpFilledIconSVG from "@/component/svg/ChevronUpFilledIconSVG";

type DropDownOption = {
  label: string;
  value: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST = 8;
const DROPDOWN_OPTION_HEIGHT = 40;

const DropDownComponent = ({
  value,
  handleChange,
  list,
  placeholder,
  isSearchable = false,
  maxOuputInDropdownList = DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST,
}: {
  value: string;
  handleChange: (value: string) => void;
  list: DropDownOption[];
  placeholder: string;
  isSearchable?: boolean;
  maxOuputInDropdownList?: number;
}) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = list.find((item) => item.value === value);
  const dropdownMaxHeight = maxOuputInDropdownList * DROPDOWN_OPTION_HEIGHT;

  const filteredList = useMemo(() => {
    if (!isSearchable) {
      return list;
    }

    const normalizedSearchText = searchText.trim().toLowerCase();

    if (!normalizedSearchText) {
      return list;
    }

    return list.filter((item) => item.label.toLowerCase().includes(normalizedSearchText));
  }, [isSearchable, list, searchText]);

  const updateMenuPosition = useCallback(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const shouldOpenUpward = menuHeight > 0 && spaceBelow < menuHeight + 8 && rect.top > spaceBelow;

    setMenuPosition({
      top: shouldOpenUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isSearchable) {
      return;
    }

    setSearchText(selected?.label ?? "");
  }, [isSearchable, selected?.label]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;

      if (!containerRef.current?.contains(targetNode) && !menuRef.current?.contains(targetNode)) {
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

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();

    const handleViewportChange = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open || !menuRef.current) {
      return;
    }

    updateMenuPosition();
  }, [filteredList.length, open, updateMenuPosition]);

  const handleSelect = (item: DropDownOption) => {
    handleChange(item.value);
    setSearchText(item.label);
    setOpen(false);
  };

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
            className="z-[1000] rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0px_10px_20px_0px_#0A08411A]"
          >
            {filteredList.length > 0 ? (
              <div className="overflow-y-auto rounded-[8px]" style={{ maxHeight: `${dropdownMaxHeight}px` }}>
                {filteredList.map((item) => (
                  <div
                    key={item.value}
                    onClick={() => handleSelect(item)}
                    className={`
                      cursor-pointer px-3 py-2
                      text-[16px] leading-[125%] tracking-[-0.02em] text-[#232A25]
                      hover:bg-[#49734F0D]
                      ${selected?.value === item.value ? "bg-[#49734F0D]" : ""}
                    `}
                    style={{ minHeight: `${DROPDOWN_OPTION_HEIGHT}px` }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-[14px] text-[#747775]">No results found</div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
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
                <ChevronUpFilledIconSVG className="size-4" />
              ) : (
                <ChevronDownFilledIconSVG className="size-4" />
              )}
            </button>
          </div>
        ) : (
          <div
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-[44px] cursor-pointer items-center justify-between rounded-[8px] border border-[#E5E5E5] px-3"
          >
            <span className={`${!value ? "text-[#747775]" : "text-black"}`}>
              {selected ? selected.label : placeholder}
            </span>
            <span>
              {open ? (
                <ChevronUpFilledIconSVG className="ml-2 mt-[2px] size-4" />
              ) : (
                <ChevronDownFilledIconSVG className="ml-2 mt-[2px] size-4" />
              )}
            </span>
          </div>
        )}
      </div>
      {menu}
    </>
  );
};

export default DropDownComponent;
