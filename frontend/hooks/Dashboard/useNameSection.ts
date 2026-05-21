import { useEffect, useState } from "react";

const getStoredFullName = (): string => {
  const userData = localStorage.getItem("user");

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
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setFullName(getStoredFullName());
  }, []);

  return {
    fullName,
  };
};
