export const MEDIA_QUALITY_PRESETS = {
  standard: {
    label: "Standard",
    description: "Flags broken images, images below 0.5 MP, or images smaller than 800 × 480 in either orientation.",
    minShortEdge: 480,
    minLongEdge: 800,
    minPixels: 500_000,
  },
  strict: {
    label: "Strict",
    description: "Flags broken images, images below 0.9 MP, or images smaller than 1200 × 720 in either orientation.",
    minShortEdge: 720,
    minLongEdge: 1200,
    minPixels: 900_000,
  },
};

export function assessImageQuality({ width, height, loaded = true }, presetName = "standard") {
  const preset = MEDIA_QUALITY_PRESETS[presetName] || MEDIA_QUALITY_PRESETS.standard;
  if (!loaded || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { flagged: true, reasons: ["Image is broken or unavailable"] };
  }

  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const pixels = width * height;
  const reasons = [];

  if (shortEdge < preset.minShortEdge || longEdge < preset.minLongEdge) {
    reasons.push(`Resolution is only ${width} × ${height}`);
  }
  if (pixels < preset.minPixels) {
    reasons.push(`Image is only ${(pixels / 1_000_000).toFixed(2)} MP`);
  }

  return { flagged: reasons.length > 0, reasons };
}

