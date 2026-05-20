export function readFilesAsDataUrls(fileList, { maxFiles = 6, imageOnly = true } = {}) {
  const files = Array.from(fileList || []).slice(0, maxFiles);

  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const mimeType = file.type || guessMimeType(file.name);
    if (imageOnly && !mimeType.startsWith("image/")) {
      reject(new Error("Only image uploads are supported right now"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType, size: file.size, dataUrl: reader.result });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  })));
}

function guessMimeType(filename) {
  const extension = filename.split(".").pop()?.toLowerCase();
  const known = {
    heic: "image/heic",
    heif: "image/heif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return known[extension] || "application/octet-stream";
}

export function getUploadUrl(path) {
  if (!path) return "";
  if (typeof path === "object") return getUploadUrl(path.url || path.dataUrl);
  if (path.startsWith("http")) return path;
  if (path.startsWith("data:")) return path;
  if (path.startsWith("/uploads/")) return `${appConfig.backend.apiBaseUrl}${path}`;
  return path;
}
import { appConfig } from "@/config/appConfig";
