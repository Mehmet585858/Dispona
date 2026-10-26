"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { pushAboSpeichernFuerMich } from "./actions";

function base64UrlZuUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const roh = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(roh.length));
  for (let i = 0; i < roh.length; i += 1) {
    bytes[i] = roh.charCodeAt(i);
  }
  return bytes;
}

type Zustand = "unbekannt" | "nicht_unterstuetzt" | "moeglich" | "aktiv" | "abgelehnt";

/** Bietet an, Push-Erinnerungen für neue/geänderte/stornierte Fahrten zu aktivieren. */
export function PushAktivieren() {
  const [zustand, setZustand] = useState<Zustand>("unbekannt");

  useEffect(() => {
    async function pruefen() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setZustand("nicht_unterstuetzt");
        return;
      }
      if (Notification.permission === "denied") {
        setZustand("abgelehnt");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const abo = await registration.pushManager.getSubscription();
      setZustand(abo ? "aktiv" : "moeglich");
    }
    pruefen().catch(() => setZustand("nicht_unterstuetzt"));
  }, []);

  async function aktivieren() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setZustand("nicht_unterstuetzt");
      return;
    }
    const erlaubnis = await Notification.requestPermission();
    if (erlaubnis !== "granted") {
      setZustand("abgelehnt");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const abo = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlZuUint8Array(vapidKey),
    });
    const json = abo.toJSON();
    if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
      await pushAboSpeichernFuerMich({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
    }
    setZustand("aktiv");
  }

  if (zustand === "moeglich") {
    return (
      <Button type="button" variant="secondary" onClick={aktivieren} className="w-full">
        Erinnerungen für neue Fahrten aktivieren
      </Button>
    );
  }
  if (zustand === "abgelehnt") {
    return (
      <p className="text-sm text-ink-soft">
        Erinnerungen sind in diesem Browser blockiert. Bitte in den Einstellungen des Telefons erlauben.
      </p>
    );
  }
  return null;
}
