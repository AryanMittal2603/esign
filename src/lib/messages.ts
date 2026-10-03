import { db } from "./db";

/** Delivery states in order; a later event never moves a message backwards (except failed before delivery). */
export const MSG_RANK: Record<string, number> = { submitted: 0, enqueued: 1, sent: 2, delivered: 3, read: 4, failed: 5 };
export const MSG_LABEL: Record<string, string> = {
  submitted: "Submitted", enqueued: "Queued", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed",
};

/** Called right after the provider accepts the message. */
export async function recordSent(s: { id: string; projectId: string }, channel: "WHATSAPP" | "SMS", providerId?: string) {
  const now = new Date();
  await db.message.create({
    data: { projectId: s.projectId, signatoryId: s.id, channel, providerId: providerId ?? null, status: "submitted" },
  });
  await db.signatory.update({
    where: { id: s.id },
    data: { msgChannel: channel, msgStatus: channel === "SMS" ? "sent" : "submitted", msgStatusAt: now, msgError: null },
  });
}

export async function recordFailedSend(s: { id: string; projectId: string }, channel: "WHATSAPP" | "SMS", error: string) {
  const now = new Date();
  await db.message.create({ data: { projectId: s.projectId, signatoryId: s.id, channel, status: "failed", error: error.slice(0, 300), failedAt: now } });
  await db.signatory.update({ where: { id: s.id }, data: { msgChannel: channel, msgStatus: "failed", msgStatusAt: now, msgError: error.slice(0, 300) } });
}

/** Meta (v3) webhook format, as sent by Gupshup's console webhooks. */
type MetaStatus = { id?: string; gs_id?: string; status?: string; timestamp?: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] };
type MetaEvent = { object?: string; entry?: { changes?: { value?: { statuses?: MetaStatus[] } }[] }[] };

/** Accepts either the Gupshup v2 format or the Meta v3 format; returns how many status updates were applied. */
export async function applyWebhook(body: unknown): Promise<number> {
  let applied = 0;
  for (const evt of Array.isArray(body) ? body : [body]) {
    const meta = evt as MetaEvent;
    if (meta?.entry) {
      for (const e of meta.entry) for (const c of e.changes ?? []) for (const st of c.value?.statuses ?? []) {
        const err = st.errors?.[0];
        const r = await applyStatus({
          ids: [st.gs_id, st.id].filter(Boolean) as string[],
          waId: st.id,
          status: st.status ?? "",
          at: st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date(),
          reason: err ? [err.code, err.title, err.error_data?.details ?? err.message].filter(Boolean).join(" · ") : null,
        });
        if (r === "applied") applied++;
      }
    } else if ((await applyGupshupEvent(evt as GupshupEvent)) === "applied") applied++;
  }
  return applied;
}

type GupshupEvent = {
  type?: string;
  payload?: {
    id?: string;
    gsId?: string;
    type?: string;
    destination?: string;
    payload?: { whatsappMessageId?: string; ts?: number; reason?: string; code?: number | string };
  };
};

/**
 * Applies a Gupshup v2 "message-event". enqueued carries our Gupshup id in payload.id and the WhatsApp id in
 * payload.payload.whatsappMessageId; sent/delivered/read carry the WhatsApp id in payload.id (and usually gsId).
 */
export async function applyGupshupEvent(evt: GupshupEvent): Promise<"applied" | "ignored" | "unknown"> {
  if (evt.type !== "message-event" || !evt.payload?.type) return "ignored";
  const p = evt.payload;
  return applyStatus({
    ids: [p.gsId, p.id].filter(Boolean) as string[],
    waId: p.type === "enqueued" ? p.payload?.whatsappMessageId : undefined,
    status: p.type!,
    at: p.payload?.ts ? new Date(p.payload.ts * 1000) : new Date(),
    reason: p.type === "failed" ? [p.payload?.code, p.payload?.reason].filter(Boolean).join(" · ") || "Delivery failed" : null,
  });
}

async function applyStatus(u: { ids: string[]; waId?: string; status: string; at: Date; reason: string | null }): Promise<"applied" | "ignored" | "unknown"> {
  const status = u.status.toLowerCase();
  if (!(status in MSG_RANK) || !u.ids.length) return "ignored";
  const msg = await db.message.findFirst({ where: { OR: [{ providerId: { in: u.ids } }, { waId: { in: u.ids } }] } });
  if (!msg) return "unknown";

  const at = u.at;
  const forward = MSG_RANK[status] > MSG_RANK[msg.status] && !(status === "failed" && MSG_RANK[msg.status] >= MSG_RANK.delivered);
  const reason = status === "failed" ? u.reason || "Delivery failed" : null;
  const linkWa = u.waId && !msg.waId && u.waId !== msg.providerId;

  await db.message.update({
    where: { id: msg.id },
    data: {
      ...(linkWa ? { waId: u.waId } : {}),
      ...(forward ? { status } : {}),
      ...(status === "sent" && !msg.sentAt ? { sentAt: at } : {}),
      ...(status === "delivered" && !msg.deliveredAt ? { deliveredAt: at } : {}),
      ...(status === "read" && !msg.readAt ? { readAt: at, ...(msg.deliveredAt ? {} : { deliveredAt: at }) } : {}),
      ...(status === "failed" ? { failedAt: at, error: reason } : {}),
    },
  });

  if (forward) {
    // only the latest message decides the signatory's delivery state
    const latest = await db.message.findFirst({ where: { signatoryId: msg.signatoryId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (latest?.id === msg.id) {
      await db.signatory.update({
        where: { id: msg.signatoryId },
        data: { msgStatus: status, msgStatusAt: at, msgError: status === "failed" ? reason : null },
      });
    }
  }
  return "applied";
}
