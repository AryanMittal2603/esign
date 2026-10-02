export function maskMobile(m: string): string {
  if (m.length < 6) return m;
  return `${m.slice(0, 2)}•••••${m.slice(-3)}`;
}

const IST = "Asia/Kolkata";

export function fmtIST(d: Date | string | null | undefined, withSeconds = true): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

export function fmtTimeIST(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

export function fmtGeo(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function fmtBytes(n?: number | null): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const STATUS_META = {
  IMPORTED: { label: "Not sent", fg: "#56636F", bg: "#EEF1F0", tile: "#D4DEE0" },
  SENT: { label: "Link sent", fg: "#142844", bg: "#DCECF2", tile: "#A8BBC2" },
  OPENED: { label: "Opened", fg: "#2557DA", bg: "#E4EBFB", tile: "#2557DA" },
  VERIFIED: { label: "Verified", fg: "#2557DA", bg: "#E4EBFB", tile: "#2557DA" },
  UPLOADED: { label: "Uploaded", fg: "#7E5B12", bg: "#F7EDD5", tile: "#C9962B" },
  SIGNED: { label: "Signed", fg: "#2E7567", bg: "#E3F0EC", tile: "#2E7567" },
} as const;

export type Status = keyof typeof STATUS_META;
