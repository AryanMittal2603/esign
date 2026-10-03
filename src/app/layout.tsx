import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TipLayer } from "@/components/TipLayer";

// Fonts are bundled with the app (no Google Fonts fetch at build time).
const archivo = localFont({
  src: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-archivo",
  display: "swap",
});
const plex = localFont({
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-plex",
  display: "swap",
});

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
