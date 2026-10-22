"use client";

import ChevronDownFilledIconSVG from "@/component/svg/ChevronDownFilledIconSVG";
import ChevronUpFilledIconSVG from "@/component/svg/ChevronUpFilledIconSVG";
import {
  DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST,
  DROPDOWN_OPTION_HEIGHT,
  EMPTY_DROPDOWN_HEIGHT,
  getDropDownMenuPosition,
  getFilteredDropdownList,
} from "@/utils/ui/dropdown";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SearchableMultiSelect = ({
  values,
  handleChange,
  list,
  placeholder,
  maxOuputInDropdownList = DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST,
}: SearchableMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [menuPosition, setMenuPosition] = useState<DropDownMenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(values), [values]);
  const selectedItems = useMemo(
    () => list.filter((item) => selectedSet.has(item.value)),
    [list, selectedSet],
  );
  const availableList = useMemo(
    () => list.filter((item) => !selectedSet.has(item.value)),
    [list, selectedSet],
  );
  const filteredList = useMemo(
    () =>
      getFilteredDropdownList({
        isSearchable: true,
        list: availableList,
        searchText,
      }),
    [availableList, searchText],
  );
  const dropdownMaxHeight = maxOuputInDropdownList * DROPDOWN_OPTION_HEIGHT;
  const expectedMenuHeight =
    filteredList.length === 0
      ? EMPTY_DROPDOWN_HEIGHT
      : Math.min(filteredList.length, maxOuputInDropdownList) * DROPDOWN_OPTION_HEIGHT;
  const icon = open ? <ChevronUpFilledIconSVG className="size-4" /> : <ChevronDownFilledIconSVG className="size-4" />;

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuPosition(null);
    setSearchText("");
  }, []);

  const updateMenuPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? expectedMenuHeight;
    setMenuPosition(
      getDropDownMenuPosition({
        menuHeight,
        rect,
        viewportHeight: window.innerHeight,
      }),
    );
  }, [expectedMenuHeight]);

  const setMenuRef = useCallback(
    (node: HTMLDivElement | null) => {
      menuRef.current = node;
      if (node) {
        updateMenuPosition();
      }
    },
    [updateMenuPosition],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      if (!containerRef.current?.contains(targetNode) && !menuRef.current?.contains(targetNode)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition, filteredList.length]);

  const addValue = (value: string) => {
    if (selectedSet.has(value)) return;
    handleChange([...values, value]);
    setSearchText("");
  };

  const removeValue = (value: string) => {
    handleChange(values.filter((item) => item !== value));
  };

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={setMenuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
            className={`z-[1000] rounded-[8px] border border-[#E5E5E5] bg-white shadow-[0px_10px_20px_0px_#0A08411A] ${
              menuPosition.placement === "top" ? "origin-bottom" : "origin-top"
            }`}
          >
            {filteredList.length > 0 ? (
              <div className="overflow-y-auto rounded-[8px]" style={{ maxHeight: `${dropdownMaxHeight}px` }}>
                {filteredList.map((item) => (
                  <div
                    key={item.value}
                    onClick={() => addValue(item.value)}
                    className="cursor-pointer px-3 py-2 text-[16px] leading-[125%] tracking-[-0.02em] text-[#232A25] hover:bg-[#49734F0D]"
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
    <div className="flex flex-col gap-2">
      <div ref={containerRef} className="relative">
        <div className="flex h-[44px] items-center justify-between rounded-[8px] border border-[#E5E5E5] px-3">
          <input
            type="text"
            value={searchText}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setSearchText(event.target.value);
              if (!open) setOpen(true);
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-[16px] leading-[125%] tracking-[-0.02em] text-[#232A25] placeholder:text-[#747775] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => (open ? closeMenu() : setOpen(true))}
            className="ml-2 text-[#232A25]"
          >
            {icon}
          </button>
        </div>
      </div>
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => removeValue(item.value)}
              className="rounded-full bg-[#EFF0F3] px-3 py-1 text-sm text-[#232A25]"
            >
              {item.label} ×
            </button>
          ))}
        </div>
      )}
      {menu}
    </div>
  );
};

export default SearchableMultiSelect;
