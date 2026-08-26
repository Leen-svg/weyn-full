export const COMMUNITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const COMMUNITY_IMAGE_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

export function imageExtension(bytes, declaredType) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (declaredType === "image/jpeg" && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  if (declaredType === "image/png" && data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return "png";
  if (declaredType === "image/webp" && data.length >= 12 && String.fromCharCode(...data.slice(0, 4)) === "RIFF" && String.fromCharCode(...data.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

