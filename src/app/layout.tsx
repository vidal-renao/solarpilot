import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { THEME_SCRIPT } from "@/components/ThemeToggle";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://solarpilot-psi.vercel.app"),
  title: "SolarPilot — preestudio solar",
  description:
    "Calcula cuántos paneles caben, cuánto producen y cuánto ahorran. Con la procedencia de cada dato y la confianza que merece.",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "SolarPilot",
  },
  // Tarjeta grande: la imagen es la mitad del mensaje cuando se comparte.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Antes de pintar, para que no haya fogonazo al cambiar de tema. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
