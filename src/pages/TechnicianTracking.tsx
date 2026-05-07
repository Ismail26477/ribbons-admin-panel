import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  MapPin, Navigation, Clock, RefreshCw, Activity, LogIn, LogOut, Route, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { TrackingMap, type MapPin as MapPinT } from "@/components/TrackingMap";
import { HeatLayer, type HeatPoint } from "@/components/HeatLayer";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const GEOFENCE_M = 200;

type Status = "available" | "on_site" | "travelling" | "off_duty";

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  available:  { label: "Available",  cls: "bg-success/15 text-success border-success/30",   dot: "bg-success" },
  on_site:    { label: "On-Site",    cls: "bg-primary/15 text-primary border-primary/30",   dot: "bg-primary" },
  travelling: { label: "Travelling", cls: "bg-warning/15 text-warning border-warning/30",   dot: "bg-warning" },
  off_duty:   { label: "Off-Duty",   cls: "bg-muted text-muted-foreground border-border",   dot: "bg-muted-foreground" },
};

interface Tech {
  id: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  user_id: string | null;
  active: boolean;
}

interface LocPing {
  id: string;
  technician_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  status: string;
  address: string | null;
  created_at: string;
}

interface CheckIn {
  id: string;
  technician_id: string;
  complaint_id: string | null;
  check_in_at: string;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  address: string | null;
}

const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat/2) ** 2 + Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
    const j = await r.json();
    return j.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

// Forward geocode an address → [lat, lng]. Cached in sessionStorage.
const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  if (!address) return null;
  const key = `geo:${address}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`);
    const j = await r.json();
    if (Array.isArray(j) && j.length > 0) {
      const out: [number, number] = [parseFloat(j[0].lat), parseFloat(j[0].lon)];
      try { sessionStorage.setItem(key, JSON.stringify(out)); } catch { /* ignore */ }
      return out;
    }
  } catch { /* ignore */ }
  return null;
};

const getPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
  });

export default function TechnicianTracking() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin", "manager");

  const [techs, setTechs] = useState<Tech[]>([]);
  const [latest, setLatest] = useState<Record<string, LocPing>>({});
  const [openCheckins, setOpenCheckins] = useState<Record<string, CheckIn>>({});
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [journeyTech, setJourneyTech] = useState<Tech | null>(null);
  const [journey, setJourney] = useState<LocPing[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);

  // self technician (for technician role)
  const selfTech = useMemo(() => techs.find((t) => t.user_id === user?.id), [techs, user]);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    const { data: t } = await supabase
      .from("technicians" as never)
      .select("id,name,phone,avatar_url,user_id,active")
      .eq("active", true)
      .order("name");
    const tList = (t || []) as unknown as Tech[];
    setTechs(tList);

    if (tList.length > 0) {
      const ids = tList.map((x) => x.id);
      const { data: locs } = await supabase
        .from("technician_locations" as never)
        .select("*")
        .in("technician_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      const map: Record<string, LocPing> = {};
      ((locs || []) as unknown as LocPing[]).forEach((l) => {
        if (!map[l.technician_id]) map[l.technician_id] = l;
      });
      setLatest(map);

      const { data: cis } = await supabase
        .from("technician_checkins" as never)
        .select("*")
        .in("technician_id", ids)
        .is("check_out_at", null);
      const cmap: Record<string, CheckIn> = {};
      ((cis || []) as unknown as CheckIn[]).forEach((c) => { cmap[c.technician_id] = c; });
      setOpenCheckins(cmap);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAll();
    const i = setInterval(loadAll, 30_000);
    return () => clearInterval(i);
  }, [loadAll]);

  // Load complaint heatmap (admins only)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("complaints")
        .select("customer_address,priority")
        .not("customer_address", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      const pts: HeatPoint[] = [];
      for (const c of (data || []) as { customer_address: string; priority: string }[]) {
        const key = `geo:${c.customer_address}`;
        try {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            const [lat, lng] = JSON.parse(cached);
            pts.push({ lat, lng, intensity: c.priority === "urgent" ? 1 : c.priority === "high" ? 0.8 : 0.5 });
          }
        } catch { /* ignore */ }
      }
      setHeatPoints(pts);
    })();
  }, [isAdmin]);

  const sendPing = async (status: Status) => {
    if (!selfTech) {
      toast.error("Your account is not linked to a technician profile.");
      return;
    }
    setBusy(true);
    try {
      const pos = await getPosition();
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const address = await reverseGeocode(lat, lng);
      const { error } = await supabase.from("technician_locations" as never).insert({
        technician_id: selfTech.id, lat, lng, accuracy, status, address,
      } as never);
      if (error) throw error;
      toast.success(`Status set: ${STATUS_META[status].label}`);
      loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    if (!selfTech) return;
    setBusy(true);
    try {
      const pos = await getPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      const address = await reverseGeocode(lat, lng);

      // Geofence: find this tech's active complaints, geocode their addresses,
      // and notify if check-in is within GEOFENCE_M of any one.
      const { data: jobs } = await supabase
        .from("complaints")
        .select("id,ticket_no,customer_address,customer_name,status")
        .eq("technician_id", selfTech.id)
        .in("status", ["assigned", "in_progress"]);

      let matched: { ticket_no: string; distance_m: number } | null = null;
      for (const job of (jobs || [])) {
        if (!job.customer_address) continue;
        const coords = await geocodeAddress(job.customer_address);
        if (!coords) continue;
        const distKm = haversine([lat, lng], coords);
        const distM = distKm * 1000;
        if (distM <= GEOFENCE_M) {
          matched = { ticket_no: job.ticket_no, distance_m: Math.round(distM) };
          // Drop a notification for admins/managers (user_id NULL = staff broadcast)
          await supabase.from("notifications").insert({
            title: "✅ Geofence: technician on-site",
            body: `${selfTech.name} checked in within ${matched.distance_m}m of ${job.ticket_no}${job.customer_name ? ` (${job.customer_name})` : ""}`,
            level: "info",
            link: "/tracking",
          });
          break;
        }
      }

      const { error } = await supabase.from("technician_checkins" as never).insert({
        technician_id: selfTech.id,
        check_in_lat: lat,
        check_in_lng: lng,
        address,
        notes: matched ? `Geofence match: ${matched.ticket_no} (${matched.distance_m}m)` : null,
      } as never);
      if (error) throw error;
      await sendPing("on_site");
      toast.success(matched ? `Checked in — geofence match (${matched.distance_m}m from ${matched.ticket_no})` : "Checked in at site");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check-in failed";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const checkOut = async () => {
    if (!selfTech) return;
    const open = openCheckins[selfTech.id];
    if (!open) { toast.error("No open check-in"); return; }
    setBusy(true);
    try {
      const pos = await getPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      const { error } = await supabase
        .from("technician_checkins" as never)
        .update({ check_out_at: new Date().toISOString(), check_out_lat: lat, check_out_lng: lng } as never)
        .eq("id", open.id);
      if (error) throw error;
      await sendPing("available");
      toast.success("Checked out");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check-out failed";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const openJourney = async (t: Tech) => {
    setJourneyTech(t);
    const start = new Date(); start.setHours(0,0,0,0);
    const { data } = await supabase
      .from("technician_locations" as never)
      .select("*")
      .eq("technician_id", t.id)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true });
    setJourney(((data || []) as unknown as LocPing[]));
  };

  const journeyDistance = useMemo(() => {
    let d = 0;
    for (let i = 1; i < journey.length; i++) {
      d += haversine([journey[i-1].lat, journey[i-1].lng], [journey[i].lat, journey[i].lng]);
    }
    return d;
  }, [journey]);

  const visibleTechs = isAdmin ? techs : (selfTech ? [selfTech] : []);

  const mapPins: MapPinT[] = useMemo(
    () =>
      visibleTechs
        .map((t) => {
          const l = latest[t.id];
          if (!l) return null;
          return {
            id: t.id,
            name: t.name,
            lat: l.lat,
            lng: l.lng,
            status: l.status,
            address: l.address,
            updatedAt: l.created_at,
          } as MapPinT;
        })
        .filter((x): x is MapPinT => x !== null),
    [visibleTechs, latest],
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Live Tracking"
        description="Real-time technician location & site check-ins"
        actions={
          <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {selfTech && (
        <Card className="border-primary/20">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">My status</div>
                <div className="text-xs text-muted-foreground">
                  {latest[selfTech.id]
                    ? `Last ping ${formatDistanceToNow(new Date(latest[selfTech.id].created_at), { addSuffix: true })}`
                    : "No pings yet"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_META) as Status[]).map((s) => (
                  <Button key={s} size="sm" variant="outline" disabled={busy}
                    onClick={() => sendPing(s)}>
                    <span className={cn("mr-1.5 h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                    {STATUS_META[s].label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {openCheckins[selfTech.id] ? (
                <Button size="sm" variant="warning" disabled={busy} onClick={checkOut}>
                  <LogOut className="h-4 w-4" /> Check out
                </Button>
              ) : (
                <Button size="sm" variant="success" disabled={busy} onClick={checkIn}>
                  <LogIn className="h-4 w-4" /> Check in at site
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {mapPins.length > 0 && (
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4" /> Live map
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {mapPins.length} technician{mapPins.length === 1 ? "" : "s"} on map
              </span>
            </div>
            <TrackingMap pins={mapPins} height={380} />
          </CardContent>
        </Card>
      )}

      {isAdmin && heatPoints.length > 0 && (
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4" /> Complaint hotspots
              <span className="ml-auto text-xs font-normal text-muted-foreground">{heatPoints.length} mapped</span>
            </div>
            <div className="overflow-hidden rounded-xl border" style={{ height: 320 }}>
              <MapContainer center={[heatPoints[0].lat, heatPoints[0].lng]} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                <HeatLayer points={heatPoints} />
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTechs.map((t) => {
          const l = latest[t.id];
          const status = (l?.status as Status) || "off_duty";
          const meta = STATUS_META[status];
          const open = openCheckins[t.id];
          const fresh = l && Date.now() - new Date(l.created_at).getTime() < 5 * 60_000;
          return (
            <Card key={t.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={t.avatar_url || undefined} />
                    <AvatarFallback>{t.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-semibold">{t.name}</div>
                      {fresh && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-success">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                          </span>
                          LIVE
                        </span>
                      )}
                    </div>
                    {t.phone && <div className="text-xs text-muted-foreground">{t.phone}</div>}
                    <Badge variant="outline" className={cn("mt-1.5", meta.cls)}>
                      <span className={cn("mr-1.5 h-2 w-2 rounded-full", meta.dot)} />
                      {meta.label}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  {l ? (
                    <>
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2">{l.address || `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </div>
                      {open && (
                        <div className="flex items-center gap-1.5 text-primary">
                          <Activity className="h-3.5 w-3.5" />
                          On site since {format(new Date(open.check_in_at), "HH:mm")}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground">No location yet</div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {l && (
                    <Button asChild size="sm" variant="outline">
                      <a href={`https://www.google.com/maps?q=${l.lat},${l.lng}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Map
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openJourney(t)}>
                    <Route className="h-3.5 w-3.5" /> Journey
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {visibleTechs.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {isAdmin ? "No active technicians yet." : "Your account is not linked to a technician profile. Ask an admin to link it."}
            </CardContent>
          </Card>
        )}
      </div>

      <Sheet open={!!journeyTech} onOpenChange={(o) => !o && setJourneyTech(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{journeyTech?.name} — Today's Journey</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border p-2">
              <div className="text-base font-bold">{journey.length}</div>
              <div className="text-muted-foreground">Pings</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-base font-bold">{journeyDistance.toFixed(1)} km</div>
              <div className="text-muted-foreground">Distance</div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="text-base font-bold">
                {journey.length > 1
                  ? formatDistanceToNow(new Date(journey[0].created_at)).replace("about ", "")
                  : "—"}
              </div>
              <div className="text-muted-foreground">Active</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {journey.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">No pings today.</div>
            )}
            {journey.map((p, i) => {
              const meta = STATUS_META[(p.status as Status) || "off_duty"];
              return (
                <div key={p.id} className="relative flex gap-3 pl-2">
                  <div className="flex flex-col items-center">
                    <span className={cn("h-3 w-3 rounded-full ring-2 ring-background", meta.dot)} />
                    {i < journey.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(p.created_at), "HH:mm")}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.address || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
                    </div>
                    <a className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                       href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                      <Navigation className="h-3 w-3" /> Open in Maps
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
