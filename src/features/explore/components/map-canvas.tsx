"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import type { GeoPoint } from "../lib/distance";
import type { ExploreBusiness } from "../types/explore";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Marcadores propios (sin las imágenes de Leaflet, que el empaquetador no encuentra): el negocio en
// petróleo con su inicial y "tú" en un punto con anillo. Las clases de color vienen de Tailwind.
function businessIcon(name: string, selected: boolean): L.DivIcon {
  const size = selected ? 44 : 36;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span aria-hidden="true" class="flex size-full items-center justify-center rounded-full border-2 border-surface font-bold shadow-card ${
      selected
        ? "bg-secondary text-18 text-secondary-foreground"
        : "bg-primary text-14 text-primary-foreground"
    }">${name.charAt(0).toUpperCase()}</span>`,
  });
}

const YOU_ICON = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<span class="block size-full rounded-full border-4 border-surface bg-warning shadow-card ring-4 ring-warning/30"></span>',
});

interface MapCanvasProps {
  businesses: ExploreBusiness[];
  origin: GeoPoint;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Un cuadro del mapa no cargó: sin internet. */
  onTileError: () => void;
}

// El mapa de OpenStreetMap (US-025). Solo corre en el navegador: Leaflet usa `window`, por eso
// business-map.tsx lo carga con `dynamic(..., { ssr: false })`.
export default function MapCanvas({
  businesses,
  origin,
  selectedId,
  onSelect,
  onTileError,
}: MapCanvasProps) {
  // Arranca encuadrando "tú" y todos los negocios.
  const points: [number, number][] = [
    [origin.lat, origin.lng],
    ...businesses.flatMap((business): [number, number][] =>
      business.lat === null || business.lng === null
        ? []
        : [[business.lat, business.lng]],
    ),
  ];
  return (
    <MapContainer
      bounds={L.latLngBounds(points)}
      boundsOptions={{ padding: [32, 32] }}
      scrollWheelZoom
      className="size-full bg-stroke"
    >
      <TileLayer
        url={TILES}
        attribution={ATTRIBUTION}
        eventHandlers={{ tileerror: onTileError }}
      />
      <Marker
        position={[origin.lat, origin.lng]}
        icon={YOU_ICON}
        title="Tú"
        keyboard={false}
      />
      {businesses.map((business) =>
        business.lat === null || business.lng === null ? null : (
          <Marker
            key={business.id}
            position={[business.lat, business.lng]}
            icon={businessIcon(business.name, business.id === selectedId)}
            title={business.name}
            zIndexOffset={business.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(business.id) }}
          />
        ),
      )}
    </MapContainer>
  );
}
