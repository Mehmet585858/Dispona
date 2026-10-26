"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { gpsEinwilligen, gpsPositionMelden } from "./actions";

const INTERVALL_MS = 30_000;

/** GPS alle 30 Sekunden während der Schicht, nur nach Einwilligung, mit sichtbarem Hinweis (docs/06-oberflaeche.md). */
export function GpsTracking({ gpsConsentAt, schichtAktiv }: { gpsConsentAt: Date | string | null; schichtAktiv: boolean }) {
  const [einwilligung, setEinwilligung] = useState(Boolean(gpsConsentAt));
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    if (!einwilligung || !schichtAktiv || !("geolocation" in navigator)) return;

    function melden() {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          gpsPositionMelden(position.coords.latitude, position.coords.longitude).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 20_000, timeout: 15_000 },
      );
    }

    melden();
    const intervallId = setInterval(melden, INTERVALL_MS);
    return () => clearInterval(intervallId);
  }, [einwilligung, schichtAktiv]);

  async function einwilligen() {
    setLaedt(true);
    try {
      await gpsEinwilligen();
      setEinwilligung(true);
    } finally {
      setLaedt(false);
    }
  }

  if (!einwilligung) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-ground p-3 text-sm">
        <p className="text-ink">
          Dürfen wir Ihren Standort während der Schicht erfassen? So sieht die Disposition, wo Sie sind, und kann
          gefahrene Kilometer berechnen.
        </p>
        <Button type="button" variant="secondary" onClick={einwilligen} disabled={laedt} className="mt-2 w-full">
          Einverstanden
        </Button>
      </div>
    );
  }

  if (!schichtAktiv) return null;

  return (
    <p className="mt-4 text-sm text-ink-soft">📍 Standort wird während der Schicht übertragen.</p>
  );
}
