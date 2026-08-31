export type Rating = 1 | 2 | 3 | 4 | 5;

export function polishText(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const capitalised = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}
