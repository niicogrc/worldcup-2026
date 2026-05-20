import type { Metadata } from "next";
import { Bebas_Neue, Oswald, Inter } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin"],
});

const oswald = Oswald({
  weight: ["400", "700"],
  variable: "--font-oswald",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Porra Mundial 2026 | Predicciones y Leaderboard",
  description: "La porra definitiva del Mundial de la FIFA 2026. Participa con tus amigos prediciendo resultados de fase de grupos y eliminatorias en tiempo real.",
  keywords: ["Mundial 2026", "Porra Mundial", "Predicciones Fútbol", "Fútbol", "World Cup 2026"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${bebasNeue.variable} ${oswald.variable} ${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
