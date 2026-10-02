import type { Metadata } from "next";
import { SignFlow } from "@/components/sign/SignFlow";

export const metadata: Metadata = { title: "Sign your CSR · SeqreSign", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SignFlow token={token} />;
}
