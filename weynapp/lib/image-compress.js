const MAX_IMAGE_EDGE = 1600;
const MAX_COMPRESSED_IMAGE_BYTES = 1.5 * 1024 * 1024;

// Client-side only: downscales/re-encodes an image file to webp so uploads
// stay small regardless of what the admin picked (phone camera photos, etc.).
export async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxSourceEdge = Math.max(bitmap.width, bitmap.height);
  let targetEdge = MAX_IMAGE_EDGE;
  let quality = 0.8;
  let blob;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = Math.min(1, targetEdge / maxSourceEdge);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise((resolve, reject) =>
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not compress image"))), "image/webp", quality)
    );
    if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break;
    targetEdge = Math.round(targetEdge * 0.82);
    quality = Math.max(0.62, quality - 0.06);
  }
  bitmap.close();
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}
