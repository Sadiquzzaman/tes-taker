"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button, Input, SearchIcon } from "@/design/ui";

/** A search box that searches on Enter or the Search button (the admin lists search on the server). */
const AdminSearchForm = ({ label, onSearch, children }: { label: string; onSearch: (value: string) => void; children?: ReactNode }) => {
  const t = useTranslations("ui");
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {children}
      <form
        role="search"
        className="flex w-full max-w-md items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(value);
        }}
      >
        <Input
          fieldClassName="flex-1"
          label={label}
          hideLabel
          leadingIcon={<SearchIcon />}
          placeholder={label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
      </form>
    </div>
  );
};

export default AdminSearchForm;
