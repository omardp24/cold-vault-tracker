import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter para todo el texto y las cifras; JetBrains Mono solo para direcciones, hashes y códigos (ver --font-addr).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jbMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jb-mono" });

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
