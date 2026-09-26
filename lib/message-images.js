import { HttpError } from "./http.js";

export const MAX_CHAT_IMAGE_BYTES = 1_000_000;
export const MAX_MESSAGE_REQUEST_BYTES = 1_500_000;

const IMAGE_SIGNATURES = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (bytes) => bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
};

export function parseImageAttachment(input) {
  if (!input) return null;
  if (typeof input !== "object") throw new HttpError(400, "Invalid image attachment", "invalid_image");
  const type = String(input.type || "").toLowerCase();
  const data = String(input.data || "").replace(/\s/g, "");
  const verifySignature = IMAGE_SIGNATURES[type];
  if (!verifySignature) throw new HttpError(400, "Use a JPEG, PNG, or WebP image", "invalid_image_type");
  if (!data || !/^[a-z0-9+/]+={0,2}$/i.test(data)) {
    throw new HttpError(400, "The image data is invalid", "invalid_image_data");
  }
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > MAX_CHAT_IMAGE_BYTES) {
    throw new HttpError(413, "Images must be 1 MB or smaller after compression", "image_too_large");
  }
  if (!verifySignature(bytes)) throw new HttpError(400, "The image format does not match the file", "invalid_image_signature");
  const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const fallbackName = `chat-image.${extension}`;
  const name = String(input.name || fallbackName).replace(/[\r\n]/g, " ").trim().slice(0, 80) || fallbackName;
  return { data, type, name, size: bytes.length };
}
