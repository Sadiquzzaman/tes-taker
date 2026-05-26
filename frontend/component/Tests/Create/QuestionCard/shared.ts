export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type ScrollElementIntoView = (
  element: HTMLElement | null,
  behavior?: ScrollBehavior,
) => void;

export type ValidateImageFile = (file: File) => boolean;

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