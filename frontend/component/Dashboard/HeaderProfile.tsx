"use client";

import { Avatar } from "@/design/ui";
import { useHeaderProfile } from "@/hooks/Dashboard/useHeaderProfile";

/** The signed-in user's name and initials in the top bar. */
const HeaderProfile = () => {
  const { user } = useHeaderProfile();
  const name = user?.full_name || "";

  return (
    <span className="flex items-center gap-3">
      <span className="hidden max-w-40 truncate text-body-sm font-medium text-ink sm:block">{name}</span>
      <Avatar name={name || "?"} />
    </span>
  );
};

export default HeaderProfile;
