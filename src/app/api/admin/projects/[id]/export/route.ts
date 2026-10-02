import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin";
import { clientInfo, describeDevice, fail } from "@/lib/http";
import { STATUS_META, fmtIST } from "@/lib/format";
import { signingLink } from "@/lib/sms";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id }, include: { signatories: { orderBy: { centreCode: "asc" } } } });
  if (!p) return fail("Project not found", 404);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SeqreSign";
  const ws = wb.addWorksheet("Signatories", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Centre code", key: "code", width: 12 },
    { header: "Centre name", key: "centre", width: 44 },
    { header: "Signatory", key: "name", width: 26 },
    { header: "Mobile", key: "mobile", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Link sent (IST)", key: "sent", width: 22 },
    { header: "Sent via", key: "via", width: 10 },
    { header: "Opened (IST)", key: "opened", width: 22 },
    { header: "Uploaded (IST)", key: "uploaded", width: 22 },
    { header: "Pages", key: "pages", width: 8 },
    { header: "eSigned at (IST)", key: "signed", width: 22 },
    { header: "Document ID", key: "doc", width: 18 },
    { header: "Latitude", key: "lat", width: 12 },
    { header: "Longitude", key: "lng", width: 12 },
    { header: "Face check", key: "face", width: 12 },
    { header: "OTP ref", key: "otp", width: 12 },
    { header: "Device", key: "device", width: 24 },
    { header: "IP", key: "ip", width: 16 },
    { header: "Signed SHA-256", key: "hash", width: 66 },
    { header: "Secure link", key: "link", width: 60 },
  ];
  for (const s of p.signatories) {
    ws.addRow({
      code: s.centreCode, centre: s.centreName, name: s.name, mobile: s.mobile, status: STATUS_META[s.status].label,
      sent: fmtIST(s.linkSentAt), via: s.linkSentVia ?? "", opened: fmtIST(s.openedAt), uploaded: fmtIST(s.uploadedAt), pages: s.draftPages ?? "",
      signed: fmtIST(s.signedAt), doc: s.documentId ?? "", lat: s.geoLat ?? "", lng: s.geoLng ?? "", face: s.faceCheck ?? "",
      otp: s.otpRef ?? "", device: s.signUserAgent ? describeDevice(s.signUserAgent) : "", ip: s.signIp ?? "", hash: s.signedHash ?? "",
      link: s.signedAt ? "" : signingLink(s.token),
    });
  }
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF142844" } };
  ws.autoFilter = { from: "A1", to: "T1" };

  const buf = await wb.xlsx.writeBuffer();
  await audit({ action: "EXPORT_EXCEL", actor: "ADMIN", projectId: id, details: { rows: p.signatories.length }, ...clientInfo(req) });
  const file = `${p.name.replace(/[^A-Za-z0-9]+/g, "_")}_signatories.xlsx`;
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file}"` },
  });
}
