import { useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import useCreateClass from "@/hooks/api/class/useCreateClass";

export default function useCreateClassForm() {
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

  return {
    createClassPayload,
    setCreateClassPayload,
    value,
    setValue,
    loading,
    addTag,
    removeTag,
    handleCreateClass,
  };
}
