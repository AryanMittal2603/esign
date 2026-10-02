import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { fail, ok } from "@/lib/http";
import { loadByToken } from "@/lib/signer";
import { incomingPrefix } from "@/lib/storage";

export const runtime = "nodejs";

/** Issues short-lived tokens so the signatory's browser can upload large scans directly to private Blob storage. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return fail("Bad request");
  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const ctx = await loadByToken(token);
        if (!ctx?.authorised) throw new Error("Verify your mobile number first.");
        if (ctx.s.signedAt) throw new Error("This CSR is already signed.");
        if (!pathname.startsWith(incomingPrefix(ctx.s.id)) || pathname.includes("..")) throw new Error("Invalid upload path.");
        return {
          allowedContentTypes: ["application/pdf", "image/jpeg", "image/png"],
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1 GB per file
          addRandomSuffix: true,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Upload not allowed", 400);
  }
}
