"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

// Leaflets Standard-Icon findet seine Bilder sonst nicht (bekanntes Problem mit Bundlern).
const fahrzeugIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type Fahrzeug = { id: string; plate: string; position?: { lat: number; lng: number } | null };

export function Karte({
  zentrum,
  radiusKm,
  depot,
  fahrzeuge,
}: {
  zentrum: { lat: number; lng: number };
  radiusKm: number;
  depot: { lat: number; lng: number } | null;
  fahrzeuge: Fahrzeug[];
}) {
  return (
    <MapContainer
      center={[zentrum.lat, zentrum.lng]}
      zoom={11}
      scrollWheelZoom={false}
      className="h-80 w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[zentrum.lat, zentrum.lng]}
        radius={radiusKm * 1000}
        pathOptions={{ color: "#0E6E62", fillOpacity: 0.05 }}
      />
      {fahrzeuge.map((fahrzeug, index) => {
        const position = fahrzeug.position ?? (depot ? { lat: depot.lat + index * 0.001, lng: depot.lng + index * 0.001 } : null);
        if (!position) return null;
        return (
          <Marker key={fahrzeug.id} position={[position.lat, position.lng]} icon={fahrzeugIcon}>
            <Popup>{fahrzeug.plate}</Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
