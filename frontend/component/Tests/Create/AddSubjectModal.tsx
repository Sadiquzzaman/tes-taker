import NormalInput from "@/Ui/NormalInput";
import { setSingleSubject } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import useCreateSubject from "@/hooks/api/subject/userCreateSubject";
import { useState } from "react";
import CreateModal from "./CreateModal";

type CreatedSubjectOption = {
  id: string;
  label: string;
  value: string;
};

type AddSubjectModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (subject: CreatedSubjectOption) => void;
};

const initialFormState = {
  name: "",
  code: "",
};

const AddSubjectModal = ({ open, onClose, onCreated }: AddSubjectModalProps) => {
  const dispatch = useAppDispatch();
  const [formState, setFormState] = useState(initialFormState);
  const [createSubject, { loading }] = useCreateSubject();

  const handleClose = () => {
    setFormState(initialFormState);
    onClose();
  };

  const handleSubmit = async () => {
    const selectedSubject = await createSubject({
      name: formState.name,
      code: formState.code,
    });

    if (!selectedSubject) {
      return;
    }

    if (onCreated) {
      onCreated(selectedSubject);
    } else {
      dispatch(setSingleSubject(selectedSubject));
    }

    handleClose();
  };

  return (
    <CreateModal open={open} onClose={handleClose} maxWidthClassName="max-w-[520px]" panelClassName="p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.03em] text-[#232A25]">Add New Subject</p>
          <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775]">
            Create a new subject for your test library. Add a clear subject name and a short subject code.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-[500] leading-[18px] tracking-[-0.02em] text-[#0F1A12]">
              Subject name
            </label>
            <NormalInput
              value={formState.name}
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Mathematics"
              parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
              inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775]"
              afterIcon={null}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-[500] leading-[18px] tracking-[-0.02em] text-[#0F1A12]">
              Subject code
            </label>
            <NormalInput
              value={formState.code}
              onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g., MATH"
              parentClassName="h-[44px] w-full rounded-[8px] border-[#E5E5E5]"
              inputClassName="px-2 text-[16px] font-[400] leading-[125%] placeholder:text-[#747775] uppercase"
              afterIcon={null}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex h-[40px] min-w-[96px] items-center justify-center rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex h-[40px] min-w-[96px] items-center justify-center rounded-[8px] bg-[#49734F] px-4 text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-white"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
    </CreateModal>
  );
};

export default AddSubjectModal;
