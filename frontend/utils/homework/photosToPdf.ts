import { jsPDF } from "jspdf";

const A4 = { width: 210, height: 297 };
const MARGIN = 8;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });

const imageSize = (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("not an image"));
    image.src = dataUrl;
  });

/** Images the browser can put in a PDF (JPEG, PNG, WebP). */
export const isPhoto = (file: File) => /^image\/(jpeg|png|webp)$/.test(file.type);

/**
 * Several phone photos as one PDF, one A4 page each, scaled to fit with a small margin (HW-03:
 * "several photos can be combined into one PDF automatically"). Runs in the browser with jsPDF.
 */
export async function photosToPdf(photos: File[], name = "homework.pdf"): Promise<File> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (const [index, photo] of photos.entries()) {
    const dataUrl = await readAsDataUrl(photo);
    const size = await imageSize(dataUrl);
    const scale = Math.min((A4.width - 2 * MARGIN) / size.width, (A4.height - 2 * MARGIN) / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    if (index > 0) doc.addPage();
    const format = photo.type === "image/png" ? "PNG" : photo.type === "image/webp" ? "WEBP" : "JPEG";
    doc.addImage(dataUrl, format, (A4.width - width) / 2, (A4.height - height) / 2, width, height);
  }
  return new File([doc.output("blob")], name, { type: "application/pdf" });
}
