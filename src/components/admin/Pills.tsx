"use client";

import { fmtTimeIST, type Status } from "@/lib/format";

/* ── CSR progress ── */
export const CSR_META = {
  notstarted: { label: "Not started", fg: "#475569", bg: "#F1F5F9", dot: "#94A3B8" },
  opened: { label: "Opened", fg: "#1D4ED8", bg: "#EAF1FF", dot: "#3B6FF0" },
  uploaded: { label: "Uploaded", fg: "#8A5A00", bg: "#FFF4DB", dot: "#E0A100" },
  signed: { label: "Signed", fg: "#17694F", bg: "#E4F4EC", dot: "#22A06B" },
} as const;
export type CsrKey = keyof typeof CSR_META;

export function csrKey(s: Status): CsrKey {
  if (s === "SIGNED") return "signed";
  if (s === "UPLOADED") return "uploaded";
  if (s === "OPENED" || s === "VERIFIED") return "opened";
  return "notstarted";
}

export function CsrPill({ status }: { status: Status }) {
  const m = CSR_META[csrKey(status)];
  return (
    <span className="pill" style={{ color: m.fg, background: m.bg }}>
      <span className="pill-dot" style={{ background: m.dot }} />{m.label}
    </span>
  );
}

/* ── invitation delivery ── */
export const DELIVERY_META = {
  notsent: { label: "Not sent", fg: "#475569", bg: "#F1F5F9" },
  sending: { label: "Sending", fg: "#475569", bg: "#F1F5F9" },
  sent: { label: "Sent", fg: "#334155", bg: "#EEF2F6" },
  delivered: { label: "Delivered", fg: "#0F5F73", bg: "#E3F4F7" },
  read: { label: "Read", fg: "#1D4ED8", bg: "#E3ECFF" },
  failed: { label: "Failed", fg: "#B42318", bg: "#FEECEB" },
} as const;
export type DeliveryKey = keyof typeof DELIVERY_META;

export function deliveryKey(msgStatus: string | null, linkSentAt: string | null): DeliveryKey {
  if (msgStatus === "submitted" || msgStatus === "enqueued") return "sending";
  if (msgStatus === "sent" || msgStatus === "delivered" || msgStatus === "read" || msgStatus === "failed") return msgStatus;
  return linkSentAt ? "sent" : "notsent";
}

function Ticks({ n, color }: { n: 1 | 2; color: string }) {
  return (
    <svg width={n === 2 ? 17 : 12} height="11" viewBox={n === 2 ? "0 0 18 12" : "0 0 13 12"} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 6.5l3 3 6.5-7.5" />
      {n === 2 && <path d="M7 9.5l.5.5 6.5-8" />}
    </svg>
  );
}

export function DeliveryPill({ msgStatus, msgStatusAt, msgError, msgChannel, linkSentAt, linkSentVia }: {
  msgStatus: string | null; msgStatusAt?: string | null; msgError?: string | null; msgChannel?: string | null; linkSentAt?: string | null; linkSentVia?: string | null;
}) {
  const key = deliveryKey(msgStatus, linkSentAt ?? null);
  const m = DELIVERY_META[key];
  const via = msgChannel === "SMS" ? "SMS" : msgChannel === "WHATSAPP" ? "WhatsApp" : linkSentVia ?? "";
  const at = msgStatusAt ?? linkSentAt;
  const icon =
    key === "read" ? <Ticks n={2} color="#2563EB" />
    : key === "delivered" ? <Ticks n={2} color="#0F5F73" />
    : key === "sent" ? <Ticks n={1} color="#475569" />
    : key === "failed" ? <span style={{ fontWeight: 800, lineHeight: 1 }}>!</span>
    : key === "sending" ? <span className="spin-dot" />
    : <span className="pill-dot" style={{ background: "#CBD5E1" }} />;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span className="pill" style={{ color: m.fg, background: m.bg }} data-tip={msgError ?? undefined}>{icon}{m.label}</span>
      {key !== "notsent" && (
        <span className="mono ellipsis" style={{ fontSize: 10.5, color: key === "failed" ? "#B42318" : "#64748B" }} data-tip={msgError ?? undefined}>
          {key === "failed" && msgError ? msgError : [via, at ? fmtTimeIST(at).slice(0, 5) : ""].filter(Boolean).join(" · ")}
        </span>
      )}
    </span>
  );
}
