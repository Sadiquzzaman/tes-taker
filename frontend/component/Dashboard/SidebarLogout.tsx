"use client";

import axios from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useToast } from "../Toast/ToastContext";
import LogoutIconSVG from "../svg/LogoutIconSVG";

const SidebarLogout = () => {
  const { push } = useRouter();
  const { triggerToast } = useToast();
  return (
    <div className="w-full">
      <button
        className={`bg-[white] text-[#232A25] hover:bg-[#49734F] hover:text-white rounded-lg px-4 py-2 flex items-center gap-2 font-medium w-full`}
        onClick={async () => {
          await axios.post("/api/logout").then((response) => {
            if (response.status === 200) {
              localStorage.removeItem("user");
              push("/login");
              triggerToast({
                title: "Logout successful",
                type: "success",
              });
            }
          });
        }}
      >
        <LogoutIconSVG width={14} />
        Sign out
      </button>
    </div>
  );
};

export default SidebarLogout;
