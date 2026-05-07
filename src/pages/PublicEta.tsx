import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, Clock, Navigation } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const techIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(217 91% 60%);width:22px;height:22px;border-radius:50%;border:4px solid white;box-shadow:0 0 0 2px hsl(217 91% 60%),0 4px 10px rgba(0,0,0,.4)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const Recenter = ({ pos }: { pos: [number, number] }) => {
  const map = useMap();
  useEffect(() => { map.setView(pos, 15); }, [pos, map]);
  return null;
};

interface LinkInfo {
  complaint_id: string; technician_id: string; expires_at: string;
  ticket_no: string; customer_name: string | null; customer_address: string | null;
  technician_name: string; technician_phone: string | null;
}
interface Loc { lat: number; lng: number; status: string; address: string | null; created_at: string; }

const STATUS_LABEL: Record<string, string> = {
  available: "Available", on_site: "On site", travelling: "On the way", off_duty: "Off duty",
};

export default function PublicEta() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLoc = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.rpc("eta_get_location" as never, { _token: token } as never);
    const arr = (data || []) as unknown as Loc[];
    if (arr.length > 0) setLoc(arr[0]);
  }, [token]);

  useEffect(() => {
    if (!token) { setError("Invalid link"); return; }
    (async () => {
      const { data, error: e } = await supabase.rpc("eta_get_link" as never, { _token: token } as never);
      const arr = (data || []) as unknown as LinkInfo[];
      if (e || arr.length === 0) { setError("This link is invalid or has expired."); return; }
      setInfo(arr[0]);
      loadLoc();
    })();
  }, [token, loadLoc]);

  useEffect(() => {
    if (!info) return;
    const i = setInterval(loadLoc, 20_000);
    return () => clearInterval(i);
  }, [info, loadLoc]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <Card className="max-w-sm"><CardContent className="p-6 text-center">
          <h1 className="text-lg font-bold">Link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </CardContent></Card>
      </div>
    );
  }

  if (!info) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const pos: [number, number] | null = loc ? [loc.lat, loc.lng] : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-2xl p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Live Technician Location</div>
          <div className="mt-1 text-lg font-bold">{info.ticket_no}</div>
          {info.customer_name && <div className="text-sm text-muted-foreground">For {info.customer_name}</div>}
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{info.technician_name}</div>
              {info.technician_phone && (
                <a href={`tel:${info.technician_phone}`} className="inline-flex items-center gap-1 text-sm text-primary">
                  <Phone className="h-3.5 w-3.5" /> {info.technician_phone}
                </a>
              )}
            </div>
            {loc && <Badge variant="outline">{STATUS_LABEL[loc.status] || loc.status}</Badge>}
          </div>
          {loc ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              {loc.address && <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{loc.address}</span></div>}
              <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Updated {formatDistanceToNow(new Date(loc.created_at), { addSuffix: true })}</div>
            </div>
          ) : <div className="text-xs text-muted-foreground">Waiting for technician's first ping…</div>}
        </CardContent></Card>

        <Card><CardContent className="p-2">
          <div className="overflow-hidden rounded-md" style={{ height: 400 }}>
            {pos ? (
              <MapContainer center={pos} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap' />
                <Marker position={pos} icon={techIcon} />
                <Recenter pos={pos} />
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No location available yet</div>
            )}
          </div>
          {pos && (
            <a href={`https://www.google.com/maps?q=${pos[0]},${pos[1]}`} target="_blank" rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Navigation className="h-3 w-3" /> Open in Google Maps
            </a>
          )}
        </CardContent></Card>

        {info.customer_address && (
          <Card><CardContent className="p-4 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Service address</div>
            <div className="mt-1">{info.customer_address}</div>
          </CardContent></Card>
        )}

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Link auto-expires • Updates every 20 seconds
        </p>
      </div>
    </div>
  );
}
