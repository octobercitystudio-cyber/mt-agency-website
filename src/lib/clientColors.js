export const CLIENT_COLOR_PALETTE = [
  '#2563EB', '#7C3AED', '#059669', '#DB2777', '#EA580C', '#0891B2',
  '#BE123C', '#4338CA', '#047857', '#A21CAF', '#C2410C', '#0E7490',
  '#1D4ED8', '#6D28D9', '#15803D', '#BE185D', '#B45309', '#0369A1',
  '#4F46E5', '#9333EA', '#0F766E', '#9F1239', '#A16207', '#075985',
];

export const normalizeClientColor = value => {
  const color = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : null;
};

const readableGeneratedColor = value => {
  const red = value >> 16 & 255;
  const green = value >> 8 & 255;
  const blue = value & 255;
  const brightness = red * 299 + green * 587 + blue * 114;
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return brightness <= 155000 && spread >= 55;
};

export const nextClientColor = (existingColors = []) => {
  const used = new Set(existingColors.map(normalizeClientColor).filter(Boolean));
  const paletteColor = CLIENT_COLOR_PALETTE.find(color => !used.has(color));
  if (paletteColor) return paletteColor;

  // The odd step walks every value in the 24-bit RGB space before repeating.
  // Readability filtering keeps automatically assigned colors strong under white initials.
  const seed = 0x244059;
  const step = 0x9E3779;
  for (let index = 0; index < 0x1000000; index += 1) {
    const value = (seed + Math.imul(index, step)) & 0xFFFFFF;
    if (!readableGeneratedColor(value)) continue;
    const color = `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
    if (!used.has(color)) return color;
  }
  throw new Error('No unused client color is available.');
};

// Choose the higher-contrast foreground for the saved calendar background.
export const clientColorText = value => {
  const color = normalizeClientColor(value) || '#4318FF';
  const channels = [1, 3, 5].map(start => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? '#FFFFFF' : '#000000';
};
