"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

const mittelpunktIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/** MapContainers eigene center/zoom-Props wirken nur beim ersten Rendern (react-leaflet-Eigenart) -
 * ohne das hier würde die Karte z. B. nach "Mittelpunkt suchen" nicht neu zentrieren. */
function Rezentrieren({ zentrum }: { zentrum: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([zentrum.lat, zentrum.lng]);
  }, [map, zentrum.lat, zentrum.lng]);
  return null;
}

/** Einsatzgebiet wählen: Mittelpunkt per Ziehen des Markers verschieben, Radius separat als Zahl. */
export function EinsatzgebietKarte({
  zentrum,
  radiusKm,
  onZentrumVerschieben,
}: {
  zentrum: { lat: number; lng: number };
  radiusKm: number;
  onZentrumVerschieben: (zentrum: { lat: number; lng: number }) => void;
}) {
  return (
    <MapContainer
      center={[zentrum.lat, zentrum.lng]}
      zoom={10}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Rezentrieren zentrum={zentrum} />
      <Circle center={[zentrum.lat, zentrum.lng]} radius={radiusKm * 1000} pathOptions={{ color: "#0E6E62", fillOpacity: 0.05 }} />
      <Marker
        position={[zentrum.lat, zentrum.lng]}
        icon={mittelpunktIcon}
        draggable
        eventHandlers={{
          dragend: (event) => {
            const marker = event.target as L.Marker;
            const position = marker.getLatLng();
            onZentrumVerschieben({ lat: position.lat, lng: position.lng });
          },
        }}
      />
    </MapContainer>
  );
}
