export const DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST = 8;
export const DROPDOWN_OPTION_HEIGHT = 40;
export const EMPTY_DROPDOWN_HEIGHT = 40;
const DROPDOWN_VIEWPORT_GAP = 8;
const DROPDOWN_TRIGGER_GAP = 4;

export const getFilteredDropdownList = ({ isSearchable, list, searchText }: DropDownFilterArgs): DropDownOption[] => {
  if (!isSearchable) {
    return list;
  }

  const normalizedSearchText = searchText.trim().toLowerCase();

  if (!normalizedSearchText) {
    return list;
  }

  return list.filter((item) => item.label.toLowerCase().includes(normalizedSearchText));
};

export const getDropDownMenuPosition = ({
  menuHeight,
  rect,
  viewportHeight,
}: DropDownPositionArgs): DropDownMenuPosition => {
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  const shouldOpenUpward = menuHeight > 0 && spaceBelow < menuHeight + DROPDOWN_VIEWPORT_GAP && spaceAbove > spaceBelow;

  return {
    top: shouldOpenUpward
      ? Math.max(DROPDOWN_VIEWPORT_GAP, rect.top - menuHeight - DROPDOWN_TRIGGER_GAP)
      : rect.bottom + DROPDOWN_TRIGGER_GAP,
    left: rect.left,
    width: rect.width,
    placement: shouldOpenUpward ? "top" : "bottom",
  };
};
