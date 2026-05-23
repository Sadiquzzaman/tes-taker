import { useRouter } from "next/navigation";
import { useToast } from "@/component/Toast/ToastContext";
import axios from "@/lib/axios";

export const useSidebarLogout = () => {
  const { push } = useRouter();
  const { triggerToast } = useToast();

  const handleLogout = async () => {
    try {
      const response = await axios.post("/api/logout");

      if (response.status !== 200) {
        throw new Error("Logout failed");
      }

      localStorage.removeItem("user");
      push("/login");
      triggerToast({
        title: "Logout successful",
        type: "success",
      });
    } catch {
      triggerToast({
        title: "Logout failed",
        type: "error",
      });
    }
  };

  return {
    handleLogout,
  };
};
