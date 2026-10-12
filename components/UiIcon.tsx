export type IconName = "star" | "sparkle" | "arrow" | "external" | "check" | "edit" | "copy" | "grid" | "pin" | "topics" | "qr" | "chart" | "billing" | "people" | "value" | "bolt";

const paths: Record<Exclude<IconName, "star">, string> = {
  sparkle: "M12 3 14.5 9.5 21 12 14.5 14.5 12 21 9.5 14.5 3 12 9.5 9.5Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  external: "M14 4h6v6m0-6L10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
  check: "m5 12 4 4L19 6",
  edit: "m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z",
  copy: "M9 9h11v11H9ZM15 9V4H4v11h5",
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  pin: "M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  topics: "M4 5h16M4 12h16M4 19h10",
  qr: "M3 3h6v6H3ZM15 3h6v6h-6ZM3 15h6v6H3ZM15 15h3v3h3v3h-6ZM21 12h-3M12 3v3M12 12h3M3 12h3M12 18v3",
  chart: "M4 3v17h17M8 15v-4M13 15V7M18 15V4",
  billing: "M3 6h18v14H3ZM3 10h18M7 15h3",
  people: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 3a4 4 0 0 1 0 8M22 20v-2a4 4 0 0 0-3-3.9",
  value: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7Z",
};

export default function UiIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill={name === "star" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={name === "star" ? "m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L3.2 9.6l6-.9Z" : paths[name]} /></svg>;
}
