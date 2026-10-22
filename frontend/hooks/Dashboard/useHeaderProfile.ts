import { useEffect, useMemo, useRef, useState } from "react";
import { useStorageItem } from "@/hooks/useBrowserStorage";

const parseStoredUser = (userData: string | null | undefined): User | null => {
  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(userData) as User;
  } catch {
    return null;
  }
};

export const useHeaderProfile = () => {
  const [open, setOpen] = useState(false);
  const storedUser = useStorageItem("local", "user");
  const user = useMemo(() => parseStoredUser(storedUser), [storedUser]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return {
    open,
    setOpen,
    user,
    dropdownRef,
  };
};
