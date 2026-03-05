"use client";

import axios from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useToast } from "../Toast/ToastContext";

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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5.375 11.875H3.20833C2.92102 11.875 2.64547 11.7609 2.4423 11.5577C2.23914 11.3545 2.125 11.079 2.125 10.7917V3.20833C2.125 2.92102 2.23914 2.64547 2.4423 2.4423C2.64547 2.23914 2.92102 2.125 3.20833 2.125H5.375"
            stroke="#232A25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.16667 9.70817L11.875 6.99984L9.16667 4.2915"
            stroke="#232A25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M11.875 7H5.375" stroke="#232A25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sign out
      </button>
    </div>
  );
};

export default SidebarLogout;
