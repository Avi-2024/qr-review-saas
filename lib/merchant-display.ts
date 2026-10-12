const funnelLabels: Record<string, string> = {
  QR_SCANNED: "QR scans",
  RATING_SELECTED: "Rating selected",
  GENERATE_CLICKED: "Generate started",
  REVIEW_GENERATED: "Draft created",
  GOOGLE_REVIEW_OPENED: "Google opens",
};

export function funnelLabel(event: string) {
  return funnelLabels[event] ?? event.replaceAll("_", " ").toLowerCase();
}

export function activityPercentage(value: number, max: number) {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}
