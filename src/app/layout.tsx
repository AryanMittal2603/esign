import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { TipLayer } from "@/components/TipLayer";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", weight: ["400", "500", "600", "700", "800"] });
const plex = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "SeqreSign — CSR eSign",
  description: "Secure digital document workflow and eSign for examination centre reports.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F3F6F4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plex.variable}`}>
      <body>
        {children}
        <TipLayer />
      </body>
    </html>
  );
}
