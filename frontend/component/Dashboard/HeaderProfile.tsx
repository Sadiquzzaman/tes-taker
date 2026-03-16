"use client";

import axios from "@/lib/axios";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useToast } from "../Toast/ToastContext";

const HeaderProfile = () => {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // const { push } = require("next/navigation").useRouter();
  // const { triggerToast } = useToast();

  // useEffect(() => {
  //   function handleClickOutside(event: MouseEvent) {
  //     if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
  //       setOpen(false);
  //     }
  //   }

  //   document.addEventListener("mousedown", handleClickOutside);
  //   return () => {
  //     document.removeEventListener("mousedown", handleClickOutside);
  //   };
  // }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <span className="hidden sm:block font-medium text-[#232A25] text-[16px] leading-[20px]">
          {user?.full_name || ""}
        </span>
        <span className="w-8 h-8 rounded-full bg-gray-300 relative">
          <Image src="/assets/image/user.png" alt="User Avatar" fill className="object-cover rounded-full" />
        </span>
      </div>

      {/* {open && (
        <div className="absolute right-0 mt-3 w-40 bg-white border border-gray-200 rounded shadow-lg z-50">
          <button
            className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
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
            Logout
          </button>
        </div>
      )} */}
    </div>
  );
};

export default HeaderProfile;
