export const DEFAULT_MAX_OUTPUT_IN_DROPDOWN_LIST = 8;
export const DROPDOWN_OPTION_HEIGHT = 40;

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
  const shouldOpenUpward = menuHeight > 0 && spaceBelow < menuHeight + 8 && rect.top > spaceBelow;

  return {
    top: shouldOpenUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
    left: rect.left,
    width: rect.width,
  };
};
