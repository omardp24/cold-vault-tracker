import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Inter para todo el texto y las cifras; JetBrains Mono solo para direcciones, hashes y códigos (ver --font-addr).
// Las dos van como archivos en src/fonts (variables, subconjunto latino, licencia OFL) y no con next/font/google:
// en Vercel la descarga desde Google Fonts rompía la compilación ("Cannot read properties of null (reading '1')").
const inter = localFont({ src: "../fonts/Inter-latin.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
const jbMono = localFont({ src: "../fonts/JetBrainsMono-latin.woff2", weight: "100 800", variable: "--font-jb-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Cold Vault",
  description: "Portafolio y movimientos en vivo desde tu Ledger",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cold Vault",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // permite usar las safe-area del iPhone
  themeColor: "#071A20",
};

// Aplica el tema guardado ANTES del primer paint — si esto corriera en un useEffect
// normal, se vería un flash del tema equivocado (siempre oscuro) en cada carga para
// quien eligió modo claro.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("cv-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${jbMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
