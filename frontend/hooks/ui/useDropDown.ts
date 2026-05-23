"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST,
  DROPDOWN_OPTION_HEIGHT,
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

  const closeDropDown = useCallback(() => {
    setOpen(false);

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
    const menuHeight = menuRef.current?.offsetHeight ?? 0;

    setMenuPosition(
      getDropDownMenuPosition({
        menuHeight,
        rect,
        viewportHeight: window.innerHeight,
      }),
    );
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
      setMenuPosition(null);
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

  const handleInputFocus = () => {
    setOpen(true);
  };

  const handleSearchChange = (nextValue: string) => {
    setSearchText(nextValue);

    if (!open) {
      setOpen(true);
    }
  };

  const toggleDropdown = () => {
    setOpen((previousValue) => !previousValue);
  };

  return {
    open,
    searchText,
    menuPosition,
    containerRef,
    menuRef,
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
