"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST,
  DROPDOWN_OPTION_HEIGHT,
  EMPTY_DROPDOWN_HEIGHT,
  getDropDownMenuPosition,
  getFilteredDropdownList,
} from "@/utils/ui/dropdown";

const useDropDown = ({
  value,
  handleChange,
  list,
  isSearchable = false,
  maxOuputInDropdownList = DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST,
}: UseDropDownArgs) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [menuPosition, setMenuPosition] = useState<DropDownMenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = list.find((item) => item.value === value);
  const dropdownMaxHeight = maxOuputInDropdownList * DROPDOWN_OPTION_HEIGHT;

  const filteredList = useMemo(() => {
    return getFilteredDropdownList({ isSearchable, list, searchText });
  }, [isSearchable, list, searchText]);

  const expectedMenuHeight = useMemo(() => {
    if (filteredList.length === 0) {
      return EMPTY_DROPDOWN_HEIGHT;
    }

    const visibleItemCount = Math.min(filteredList.length, maxOuputInDropdownList);

    return visibleItemCount * DROPDOWN_OPTION_HEIGHT;
  }, [filteredList.length, maxOuputInDropdownList]);

  const closeDropDown = useCallback(() => {
    setOpen(false);
    setMenuPosition(null);

    if (isSearchable) {
      setSearchText(selected?.label ?? "");
    }
  }, [isSearchable, selected?.label]);

  const updateMenuPosition = useCallback(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

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
        closeDropDown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeDropDown]);

  useEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const handleSelect = (item: DropDownOption) => {
    handleChange(item.value);
    setSearchText(item.label);
    setOpen(false);
    setMenuPosition(null);
  };

  const handleInputFocus = () => {
    setSearchText(selected?.label ?? "");
    setOpen(true);
  };

  const handleSearchChange = (nextValue: string) => {
    setSearchText(nextValue);

    if (!open) {
      setOpen(true);
    }
  };

  const toggleDropdown = () => {
    if (open) {
      closeDropDown();
      return;
    }

    if (isSearchable) {
      setSearchText(selected?.label ?? "");
    }

    setOpen(true);
  };

  return {
    open,
    searchText,
    menuPosition,
    containerRef,
    menuRef,
    setMenuRef,
    selected,
    filteredList,
    dropdownMaxHeight,
    handleSelect,
    handleInputFocus,
    handleSearchChange,
    toggleDropdown,
  };
};

export default useDropDown;
