import useAddStudentInClass from "@/hooks/api/class/useAddStudentInClass";
import { useEffect, useState } from "react";
import { useToast } from "../Toast/ToastContext";
import CrossIconSVG from "../svg/CrossIconSVG";
import TagInput from "@/Ui/TagInput";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import Link from "next/link";
import ButtonLoader from "../Loader/ButtonLoadder";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setOpenAddStudentModal } from "@/lib/features/classSlice";

const AddStudentModal = ({ fetchClassDetails }: { fetchClassDetails: () => void }) => {
  const dispatch = useAppDispatch();
  const { openAddStudentModal } = useAppSelector((state) => state.class);
  const [addStudent, { loading }] = useAddStudentInClass({ classId: openAddStudentModal?.id || "" });
  const [value, setValue] = useState("");
  const [students, setStudents] = useState<string[]>([]);
  const { triggerToast } = useToast();
  // Lock scroll when modal is open
  useEffect(() => {
    if (openAddStudentModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [openAddStudentModal]);

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
    } else if (trimmed.includes("@") && emailRegex.test(trimmed)) {
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
      setStudents((prev) => [...prev, trimmed]);
      setValue("");
    }
  };

  const removeTag = (index: number) => {
    setStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    dispatch(setOpenAddStudentModal(null));
  };

  const handleAddStudent = () => {
    if (students.length === 0) {
      triggerToast({
        title: "No students added",
        description: "Please add at least one student email or phone number.",
        type: "error",
      });
    } else {
      addStudent({ students }).then((res) => {
        if (res?.statusCode === 201) {
          handleClose();
          fetchClassDetails();
        }
      });
    }
  };
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${openAddStudentModal ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        aria-hidden="true"
      >
        <div
          className={`absolute top-2 right-2 h-[calc(100vh-8px)] w-[calc(100vw-8px)] sm:w-[584px] z-50 bg-white rounded-xl p-4 sm:p-8 shadow-lg overflow-auto transition-transform duration-500 ${openAddStudentModal ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
          style={{ maxHeight: "calc(100vh - 16px)" }}
          aria-modal="true"
          role="dialog"
        >
          <div className="pb-4 flex justify-between items-center">
            <p className="font-[600] text-[24px] leading-[24px] tracking-[-0.04em] text-[#232A25]">Add Student</p>
            <button className="text-[#747775]" onClick={handleClose}>
              <CrossIconSVG width={24} />
            </button>
          </div>
          <div className="h-[200px] rounded-lg bg-[#EFF0F3] my-4 flex justify-center items-center">
            <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">GIF Tutorial</p>
          </div>
          <div className="w-full flex flex-col gap-4 pt-4">
            <p className={`font-[500] text-[16px] leading-[16px] tracking-[-0.02em] text-[#0F1A12]`}>
              Enter student email or phone
            </p>
            <TagInput
              placeholder="Enter student email or phone"
              inputClassName="px-2"
              afterIcon={null}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              tags={students}
              removeTag={removeTag}
              addTag={addTag}
            />
          </div>
          <div className="flex justify-between items-center gap-4 mt-4">
            <p className={`font-[400] text-[14px] leading-[14px] tracking-[-0.02em] text-[#747775]`}>
              Invite by single/bulk email or phone.
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
              onClick={handleAddStudent}
              disabled={loading}
              className={`px-4 h-10 flex items-center justify-center rounded-[8px] text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${loading ? "bg-[#747775]" : "bg-[#49734F]"} text-[#FFFFFF]`}
            >
              <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
              {loading ? "Confirming..." : "Confirm"}
              <RightArrowIconSVG />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddStudentModal;
