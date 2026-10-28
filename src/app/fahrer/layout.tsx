import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Fahrer" },
};

export const viewport: Viewport = {
  themeColor: "#334155",
};

export default function FahrerLayout({ children }: LayoutProps<"/fahrer">) {
  return (
    <>
      <ServiceWorkerRegistrar />
      {children}
    </>
  );
}
