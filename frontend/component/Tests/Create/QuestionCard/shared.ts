export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const QUESTION_BUILDER_GAPS = {
  blockOuter: "gap-2",
  normalCardInner: "gap-6",
  passageQuestionCardInner: "gap-2",
  passageInner: "gap-2",
  passageHeader: "gap-2",
  passageHeaderRow: "gap-4",
  passageChildren: "gap-4",
  validation: "gap-1",
  headerOuter: "gap-8",
  headerContent: "gap-4",
  headerLead: "gap-2",
  headerText: "gap-3",
  headerImageActions: "gap-2",
  headerSide: "gap-2",
  bodyStack: "gap-2",
  optionRow: "gap-2",
  optionContent: "gap-3",
  optionImageActions: "gap-2",
  optionActionButtons: "gap-1",
  optionSide: "gap-2",
  addOptionRow: "gap-2",
  footerOuter: "gap-4",
  footerGroup: "gap-2",
  instruction: "gap-2",
  textAnswerStack: "gap-3",
  textAnswerInput: "gap-2",
  matchingBody: "gap-1",
  matchingAddButton: "gap-2",
  matchingRow: "gap-4",
  matchingSide: "gap-2",
} as const;

export const resizeTextarea = (element: HTMLTextAreaElement | null) => {
  if (!element) {
    return;
  }

  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};

export const readImageFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read image file."));
    };

    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
