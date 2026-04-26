"use client";

import NormalInput from "@/Ui/NormalInput";
import { useState } from "react";
import ImportantIconSVG from "../svg/ImportantIconSvg";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import TagInput from "@/Ui/TagInput";
import { useToast } from "../Toast/ToastContext";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import Link from "next/link";
import axiosReq from "@/lib/axios";
import useCreateClass from "@/hooks/api/class/useCreateClass";
import ButtonLoader from "../Loader/ButtonLoadder";

const CreateClassForm = () => {
  const { triggerToast } = useToast();
  const [mutate, { loading }] = useCreateClass();
  const [createClassPayload, setCreateClassPayload] = useState<CreateClassPayload>({
    class_name: "",
    description: "",
    student_ids: [],
  });

  const [value, setValue] = useState("");

  const addTag = () => {
    const trimmed = value.trim();

    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d+$/;

    if (!emailRegex.test(trimmed) && !phoneRegex.test(trimmed)) {
      triggerToast({
        title: "Invalid input",
        description: "Please enter a valid email address or phone number.",
        type: "error",
      });
    } else if (trimmed.includes("@") && !emailRegex.test(trimmed)) {
      triggerToast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        type: "error",
      });
    } else if (phoneRegex.test(trimmed) && trimmed.length !== 11) {
      triggerToast({
        title: "Invalid phone number",
        description: "Phone number must be 11 digits.",
        type: "error",
      });
    } else {
      setCreateClassPayload((prev) => ({ ...prev, student_ids: [...prev.student_ids, trimmed] }));
      setValue("");
    }
  };

  const removeTag = (index: number) => {
    setCreateClassPayload((prev) => ({ ...prev, student_ids: prev.student_ids.filter((_, i) => i !== index) }));
  };

  const handleCreateClass = () => {
    if (createClassPayload.class_name.trim() === "") {
      triggerToast({
        title: "Class name is required",
        description: "Please enter a class name.",
        type: "error",
      });
    } else {
      mutate(createClassPayload);
    }
  };

  return (
    <>
      <div className="w-ful my-2 py-2 sm:my-4 sm:py-4 border-b border-[#E5E5E5] flex flex-col gap-2">
        <p className={`font-[400] text-[14px] leading-[17px] tracking-[-0.02em] text-[#747775]`}>Step 1</p>
        <p className={`font-[600] text-[24px] leading-[24px] tracking-[-0.04em] text-[#747775]`}>Class details</p>
      </div>
      <div className="w-ful flex flex-col gap-2">
        <p className={`font-[500] text-[15px] leading-[125%] tracking-[-0.02em] text-[#0F1A12]`}>Class name</p>
        <NormalInput
          value={createClassPayload.class_name}
          onChange={(e) => setCreateClassPayload((prev) => ({ ...prev, class_name: e.target.value }))}
          parentClassName="w-full border-[#E5E5E5] rounded-[8px] h-[44px]"
          inputClassName="text-[16px] leading-[125%] font-[400] placeholder:text-[#747775] px-2"
          placeholder="e.g., Class 9A - Mathematics"
          afterIcon={null}
        />
      </div>
      <div className="w-ful flex flex-col gap-2 mt-4">
        <p className={`font-[500] text-[15px] leading-[125%] tracking-[-0.02em] text-[#0F1A12]`}>
          Class description (Optional)
        </p>
        <NormalInput
          value={createClassPayload.description}
          onChange={(e) => setCreateClassPayload((prev) => ({ ...prev, description: e.target.value }))}
          parentClassName="w-full border-[#E5E5E5] rounded-[8px] h-[44px]"
          inputClassName="text-[16px] leading-[125%] font-[400] placeholder:text-[#747775] px-2"
          placeholder="e.g., This class is for 9th grade mathematics"
          afterIcon={null}
        />
      </div>
      <div className="w-ful my-2 py-2 sm:my-4 sm:py-4 border-b border-[#E5E5E5] flex flex-col gap-2">
        <p className={`font-[400] text-[14px] leading-[17px] tracking-[-0.02em] text-[#747775]`}>Step 2</p>
        <p className={`font-[600] text-[24px] leading-[24px] tracking-[-0.04em] text-[#747775]`}>Add students</p>
      </div>
      <div className="w-ful flex flex-col gap-2">
        <p
          className={`font-[500] text-[16px] leading-[125%] tracking-[-0.02em] text-[#0F1A12] flex items-center gap-1`}
        >
          Student email or phone (Optional) <ImportantIconSVG />{" "}
        </p>
        <TagInput
          placeholder="Enter student email or phone"
          inputClassName="px-2"
          afterIcon={null}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          tags={createClassPayload.student_ids}
          removeTag={removeTag}
          addTag={addTag}
        />
      </div>
      <div className="flex justify-between items-center gap-2 mt-4">
        <p className={`font-[400] text-[16px] leading-[125%] tracking-[-0.02em] text-[#747775]`}>
          Invite by single/bulk email or phone. You can always add students later.{" "}
        </p>
        <button
          type="button"
          onClick={addTag}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 w-[71px] h-[32px] ${value.trim() === "" ? "bg-[#747775]" : "bg-[#232A25]"} rounded-lg text-white text-sm font-medium tracking-[-0.02em] capitalize`}
        >
          <HumanAddIconSVG />
          Add
        </button>
      </div>
      <div className="flex justify-end items-center gap-2 sm:gap-4 mt-6">
        <Link
          href="/classes"
          className={`px-4 h-10 flex items-center justify-center rounded-[8px] text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${loading ? "bg-[#747775]" : "bg-[#EFF0F3]"} text-[#232A25]`}
        >
          Cancel
        </Link>
        <button
          onClick={handleCreateClass}
          disabled={loading}
          className={`px-4 h-10 flex items-center justify-center rounded-[8px] text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${loading ? "bg-[#747775]" : "bg-[#49734F]"} text-[#FFFFFF]`}
        >
          <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
          {loading ? "Creating..." : "Create Class"}
          <RightArrowIconSVG />
        </button>
      </div>
    </>
  );
};

export default CreateClassForm;
