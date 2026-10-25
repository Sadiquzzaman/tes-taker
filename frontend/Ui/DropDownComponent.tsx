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
  disabled = false,
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
  const icon = open ? <ChevronUpFilledIconSVG className="size-4" /> : <ChevronDownFilledIconSVG className="size-4" />;

  const menu =
    !disabled && open && menuPosition
      ? createPortal(
          <div
            ref={setMenuRef}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
            className={`z-[1000] rounded-input border border-border bg-surface shadow-[0px_10px_20px_0px_#0A08411A] ${
              menuPosition.placement === "top" ? "origin-bottom" : "origin-top"
            }`}
          >
            {filteredList.length > 0 ? (
              <div className="overflow-y-auto rounded-input" style={{ maxHeight: `${dropdownMaxHeight}px` }}>
                {filteredList.map((item) => (
                  <div
                    key={item.value}
                    onClick={() => handleSelect(item)}
                    className={`
                      cursor-pointer px-3 py-2
                      text-body text-ink
                      hover:bg-primary-soft
                      ${selected?.value === item.value ? "bg-primary-soft" : ""}
                    `}
                    style={{ minHeight: `${DROPDOWN_OPTION_HEIGHT}px` }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-body-sm text-ink-muted">No results found</div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={containerRef} className="relative">
        {isSearchable ? (
          <div
            className={`flex h-[44px] items-center justify-between rounded-input border border-border px-3 ${
              disabled ? "pointer-events-none bg-canvas opacity-70" : ""
            }`}
          >
            <input
              type="text"
              value={searchText}
              onFocus={handleInputFocus}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full bg-transparent text-body text-ink placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed"
            />
            <button type="button" disabled={disabled} onClick={toggleDropdown} className="ml-2 text-ink">
              {icon}
            </button>
          </div>
        ) : (
          <div
            onClick={disabled ? undefined : toggleDropdown}
            className={`flex h-[44px] items-center justify-between rounded-input border border-border px-3 ${
              disabled ? "cursor-not-allowed bg-canvas opacity-70" : "cursor-pointer"
            }`}
          >
            <span className={`${!value ? "text-ink-muted" : "text-black"}`}>
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
