import { useRouter } from "next/navigation";
import { useToast } from "@/component/Toast/ToastContext";
import axios from "axios";

export const useSidebarLogout = () => {
  const { push } = useRouter();
  const { triggerToast } = useToast();

  const handleLogout = async () => {
    try {
      // Same-origin Next.js session route (not Nest /api).
      const response = await axios.post("/session/logout");

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
