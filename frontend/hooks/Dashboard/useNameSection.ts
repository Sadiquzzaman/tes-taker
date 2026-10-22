import { useStorageItem } from "@/hooks/useBrowserStorage";

const getStoredFullName = (userData: string | null | undefined): string => {
  if (!userData) {
    return "";
  }

  try {
    const user = JSON.parse(userData) as User;
    return user.full_name || "";
  } catch {
    return "";
  }
};

export const useNameSection = () => {
  const fullName = getStoredFullName(useStorageItem("local", "user"));

  return {
    fullName,
  };
};
