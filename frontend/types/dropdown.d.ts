interface DropDownOption {
  label: string;
  value: string;
}

interface DropDownMenuPosition {
  top: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
}

interface DropDownFilterArgs {
  isSearchable: boolean;
  list: DropDownOption[];
  searchText: string;
}

interface DropDownPositionArgs {
  menuHeight: number;
  rect: DOMRect;
  viewportHeight: number;
}

interface UseDropDownArgs {
  value: string;
  handleChange: (value: string) => void;
  list: DropDownOption[];
  isSearchable?: boolean;
  maxOuputInDropdownList?: number;
}

interface DropDownComponentProps extends UseDropDownArgs {
  placeholder: string;
}
