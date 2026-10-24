import NormalInput from "@/Ui/NormalInput";
import { setSingleSubject } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import useCreateSubject from "@/hooks/api/subject/userCreateSubject";
import { useState } from "react";
import CreateModal from "./CreateModal";

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
        <p className="text-title-sm font-semibold tracking-tight text-ink">Add New Subject</p>
        <p className="text-body-sm font-normal text-ink-muted">
          Create a new subject for your test library. Add a clear subject name and a short subject code.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-body-sm font-medium text-ink">
            Subject name
          </label>
          <NormalInput
            value={formState.name}
            onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Mathematics"
            parentClassName="h-[44px] w-full rounded-input border-border"
            inputClassName="px-2 text-body font-normal placeholder:text-ink-muted"
            afterIcon={null}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-body-sm font-medium text-ink">
            Subject code
          </label>
          <NormalInput
            value={formState.code}
            onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="e.g., MATH"
            parentClassName="h-[44px] w-full rounded-input border-border"
            inputClassName="px-2 text-body font-normal placeholder:text-ink-muted uppercase"
            afterIcon={null}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="flex h-[40px] min-w-[96px] items-center justify-center rounded-input bg-canvas px-4 text-body-sm font-medium text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex h-[40px] min-w-[96px] items-center justify-center rounded-input bg-primary px-4 text-body-sm font-medium text-ink-inverse"
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </div>
    </CreateModal>
  );
};

export default AddSubjectModal;
