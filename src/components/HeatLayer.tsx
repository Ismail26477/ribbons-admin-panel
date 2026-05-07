import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export interface HeatPoint { lat: number; lng: number; intensity?: number; }

export const HeatLayer = ({ points, radius = 25, blur = 18 }: { points: HeatPoint[]; radius?: number; blur?: number; }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const data = points.map((p) => [p.lat, p.lng, p.intensity ?? 0.5] as [number, number, number]);
    // @ts-expect-error leaflet.heat extends L
    const layer = L.heatLayer(data, {
      radius, blur, maxZoom: 17,
      gradient: { 0.2: "#22c55e", 0.4: "#eab308", 0.6: "#f97316", 0.8: "#ef4444", 1.0: "#dc2626" },
    });
    layer.addTo(map);
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 13 });
    }
    return () => { map.removeLayer(layer); };
  }, [points, map, radius, blur]);
  return null;
};
