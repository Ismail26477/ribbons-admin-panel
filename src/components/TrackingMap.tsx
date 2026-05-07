import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Leaflet expects assets at relative paths)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const colorIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px ${color},0 2px 6px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });

const STATUS_COLORS: Record<string, string> = {
  available: "#22c55e",
  on_site: "#3b82f6",
  travelling: "#f59e0b",
  off_duty: "#94a3b8",
};

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  address?: string | null;
  updatedAt?: string;
}

const FitBounds = ({ pins }: { pins: MapPin[] }) => {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [pins, map]);
  return null;
};

export const TrackingMap = ({ pins, height = 380 }: { pins: MapPin[]; height?: number }) => {
  const center: [number, number] = pins.length > 0 ? [pins[0].lat, pins[0].lng] : [20.5937, 78.9629];

  return (
    <div className="overflow-hidden rounded-xl border" style={{ height }}>
      <MapContainer center={center} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={colorIcon(STATUS_COLORS[p.status] || "#94a3b8")}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs capitalize">{p.status.replace("_", " ")}</div>
                {p.address && <div className="mt-1 text-xs text-muted-foreground">{p.address}</div>}
                <a
                  href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-blue-600 underline"
                >
                  Open in Google Maps
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds pins={pins} />
      </MapContainer>
    </div>
  );
};

export default TrackingMap;
export { icon };
