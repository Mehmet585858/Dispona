import { Logo } from "@/components/ui/Logo";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ground px-6 text-center">
      <Logo className="h-8 text-ink" />
      <p className="max-w-md text-base text-muted">
        Telefon und Auto-Dispo für Krankenfahrdienste.
      </p>
    </div>
  );
}
