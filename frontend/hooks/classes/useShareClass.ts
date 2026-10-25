import { useState } from "react";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { buildClassJoinLink } from "@/utils/frontendAppUrl";

/** State of the Share class dialog: which class, its join link, and closing it. */
export default function useShareClass() {
  const { openShareClassModal: classData } = useAppSelector((state) => state.class);
  const open = Boolean(classData);
  const dispatch = useAppDispatch();
  const [classLink, setClassLink] = useState("");
  // Keep the last link while the dialog closes, so the text does not go blank.
  const nextClassLink = classData?.id ? buildClassJoinLink(classData.id) : null;
  if (nextClassLink && nextClassLink !== classLink) {
    setClassLink(nextClassLink);
  }

  const handleClose = () => {
    dispatch(setOpenShareClassModal(null));
  };

  return { classData, open, classLink, handleClose };
}
