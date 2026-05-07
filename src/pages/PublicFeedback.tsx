import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PublicFeedback() {
  const { complaintId, token } = useParams<{ complaintId: string; token: string }>();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [ticketNo, setTicketNo] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!complaintId || !token) { setValid(false); return; }
      const { data } = await supabase.from("complaints").select("ticket_no,feedback_token,status").eq("id", complaintId).maybeSingle();
      if (!data || data.feedback_token !== token || data.status !== "completed") setValid(false);
      else { setValid(true); setTicketNo(data.ticket_no); }
    })();
  }, [complaintId, token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("customer_feedback").insert({
      complaint_id: complaintId!, feedback_token: token!, rating, comment, customer_name: name,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else setDone(true);
  };

  if (valid === null) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (valid === false) return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md text-center"><CardContent className="p-8">
        <div className="text-lg font-semibold">This feedback link is no longer valid.</div>
        <p className="mt-2 text-sm text-muted-foreground">Please contact Ribbons Infotech if you need help.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-xl font-bold text-white">R</div>
          <CardTitle>How was your service?</CardTitle>
          <p className="text-sm text-muted-foreground">Ticket {ticketNo} · Ribbons Infotech</p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <div className="text-lg font-semibold">Thank you!</div>
              <p className="text-sm text-muted-foreground">Your feedback helps us improve.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label className="mb-2 block text-center">Rate your experience</Label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} type="button" onClick={() => setRating(r)}
                      className={`flex h-12 w-12 items-center justify-center rounded-lg border transition-all ${rating >= r ? "scale-105 border-warning bg-warning/15 text-warning" : "text-muted-foreground"}`}>
                      <Star className="h-6 w-6" fill={rating >= r ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>
              <div><Label>Your name (optional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Comments (optional)</Label><Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us about the technician's work…" /></div>
              <Button type="submit" disabled={busy} className="w-full">{busy ? "Submitting…" : "Submit feedback"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
