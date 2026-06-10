"use client";

import ChevronDownFilledIconSVG from "@/component/svg/ChevronDownFilledIconSVG";
import ChevronUpFilledIconSVG from "@/component/svg/ChevronUpFilledIconSVG";
import useDropDown from "@/hooks/ui/useDropDown";
import { DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST, DROPDOWN_OPTION_HEIGHT } from "@/utils/ui/dropdown";
import { createPortal } from "react-dom";

const DropDownComponent = ({
  value,
  handleChange,
  list,
  placeholder,
  isSearchable = false,
  maxOuputInDropdownList = DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST,
}: DropDownComponentProps) => {
  const {
    open,
    searchText,
    menuPosition,
    containerRef,
    setMenuRef,
    selected,
    filteredList,
    dropdownMaxHeight,
    handleSelect,
    handleInputFocus,
    handleSearchChange,
    toggleDropdown,
  } = useDropDown({
    value,
    handleChange,
    list,
    isSearchable,
    maxOuputInDropdownList,
  });
  const icon = open ? (
    <ChevronUpFilledIconSVG className="size-4" />
  ) : (
    <ChevronDownFilledIconSVG className="size-4" />
  );

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
              onFocus={handleInputFocus}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-[16px] leading-[125%] tracking-[-0.02em] text-[#232A25] placeholder:text-[#747775] focus:outline-none"
            />
            <button type="button" onClick={toggleDropdown} className="ml-2 text-[#232A25]">
              {icon}
            </button>
          </div>
        ) : (
          <div
            onClick={toggleDropdown}
            className="flex h-[44px] cursor-pointer items-center justify-between rounded-[8px] border border-[#E5E5E5] px-3"
          >
            <span className={`${!value ? "text-[#747775]" : "text-black"}`}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="ml-2 mt-[2px]">{icon}</span>
          </div>
        )}
      </div>
      {menu}
    </>
  );
};

export default DropDownComponent;
