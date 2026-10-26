import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fahrdienst-KI",
  description: "KI am Telefon, eigene Disposition und Fahrer-App für Krankenfahrdienste.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ground text-ink">{children}</body>
    </html>
  );
}
