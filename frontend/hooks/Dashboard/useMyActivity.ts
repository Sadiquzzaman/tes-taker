import { useEffect, useRef, useState } from "react";
import { sampleActivityDuration } from "@/utils/Dashboard/activity";

export const useMyActivity = () => {
  const [open, setOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<ActivityDuration>(sampleActivityDuration[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAnimationActive = true;

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
    selectedDuration,
    setSelectedDuration,
    dropdownRef,
    isAnimationActive,
  };
};
