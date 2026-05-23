export const resizeTextarea = (element: HTMLTextAreaElement | null) => {
  if (!element) return;

  const lineHeight = 20;
  const maxHeight = lineHeight * 4;

  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
};
