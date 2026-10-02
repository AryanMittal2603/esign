/** Human wording for audit actions — shared by the admin timeline, audit page and certificate. */
export const ACTION_TEXT: Record<string, string> = {
  ADMIN_LOGIN: "Admin signed in",
  PROJECT_CREATED: "Project created",
  SIGNATORY_ADDED: "Signatory added",
  SIGNATORIES_IMPORTED: "Signatories imported from CSV",
  SIGNATORY_REMOVED: "Signatory removed",
  LINK_SENT: "Secure link sent",
  LINK_SEND_FAILED: "Secure link could not be sent",
  LINK_OPENED: "Secure link opened",
  OTP_SENT: "Verification OTP sent",
  OTP_VERIFIED: "Mobile verified with OTP",
  OTP_FAILED: "Wrong verification OTP entered",
  CSR_UPLOADED: "CSR uploaded",
  CSR_REPLACED: "CSR replaced",
  PHOTO_CAPTURED: "Live photo captured · location recorded",
  CONSENT_ACCEPTED: "Declarations accepted",
  SIGN_OTP_SENT: "Signing OTP sent",
  SIGN_OTP_FAILED: "Wrong signing OTP entered",
  SIGNED: "Signed with OTP · PDF sealed and stored encrypted",
  SIGNED_DOWNLOADED: "Signed PDF downloaded",
  EXPORT_EXCEL: "Excel report exported",
  EXPORT_ZIP: "Signed CSRs downloaded as ZIP",
};

export function actionText(action: string, details?: unknown): string {
  const base = ACTION_TEXT[action] ?? action;
  const d = (details ?? {}) as Record<string, unknown>;
  if ((action === "CSR_UPLOADED" || action === "CSR_REPLACED") && d.pages) return `${base} · ${d.pages} page${d.pages === 1 ? "" : "s"}`;
  if (action === "LINK_SENT" && d.via) return `${base} by ${d.via}`;
  if (action === "SIGNATORIES_IMPORTED" && d.count) return `${base} · ${d.count} rows`;
  return base;
}
