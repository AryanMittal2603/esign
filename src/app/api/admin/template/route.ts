import { requireAdmin } from "@/lib/admin";
import { fail } from "@/lib/http";

export async function GET() {
  if (!(await requireAdmin())) return fail("Sign in first", 401);
  const csv = "name,mobile,centre_code,centre_name\nRamesh Kumar Verma,9876543210,1042,\"Govt. Inter College, Hazratganj, Lucknow\"\n";
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="seqresign_signatories_template.csv"' },
  });
}
