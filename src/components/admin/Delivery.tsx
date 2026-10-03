"use client";

import { fmtTimeIST } from "@/lib/format";

/** WhatsApp-style delivery ticks: ✓ sent · ✓✓ delivered · blue ✓✓ read · red failed. */
export function DeliveryBadge({ status, at, error, channel }: { status: string | null; at?: string | null; error?: string | null; channel?: string | null }) {
  if (!status) return null;
  const via = channel === "SMS" ? "SMS" : "WhatsApp";
  const time = at ? fmtTimeIST(at).slice(0, 5) : "";
  const tick = (d: string) => <path d={d} />;
  const ticks = (n: 1 | 2, color: string) => (
    <svg width={n === 2 ? 18 : 13} height="12" viewBox={n === 2 ? "0 0 18 12" : "0 0 13 12"} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tick("M1.5 6.5l3 3 6.5-7.5")}
      {n === 2 && tick("M7 9.5l.5.5 6.5-8")}
    </svg>
  );
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    submitted: { label: "Sending", color: "#8C99A6", icon: <ClockIcon /> },
    enqueued: { label: "Queued", color: "#8C99A6", icon: <ClockIcon /> },
    sent: { label: "Sent", color: "#637383", icon: ticks(1, "#637383") },
    delivered: { label: "Delivered", color: "#637383", icon: ticks(2, "#637383") },
    read: { label: "Read", color: "#2557DA", icon: ticks(2, "#2557DA") },
    failed: { label: "Failed", color: "#B23A3A", icon: <span style={{ fontWeight: 800 }}>!</span> },
  };
  const m = map[status] ?? map.submitted;
  return (
    <span className="mono" data-tip={error ? `${via}: ${error}` : `${via} · ${m.label}${time ? ` at ${time}` : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: m.color, whiteSpace: "nowrap" }}>
      {m.icon} {via} · {m.label}{time && status !== "failed" ? ` ${time}` : ""}
    </span>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
