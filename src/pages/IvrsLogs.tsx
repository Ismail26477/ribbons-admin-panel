import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Phone } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { format } from "date-fns";

interface Log {
  id: string; call_sid: string | null; caller_phone: string | null; digits: string | null;
  issue_type: string | null; complaint_id: string | null; created_at: string;
}

export default function IvrsLogs() {
  const [rows, setRows] = useState<Log[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    supabase.from("ivrs_call_logs").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setRows((data || []) as Log[]));
  }, []);
  const filtered = rows.filter((r) =>
    !search ||
    (r.call_sid || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.caller_phone || "").includes(search) ||
    (r.issue_type || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <PageHeader
        title="IVRS Call Logs"
        description="Every IVRS intake recorded automatically by the system."
        actions={
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => downloadCSV("ivrs-logs.csv", filtered as never)}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        }
      />
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search SID, phone, issue…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <div className="overflow-x-auto no-scrollbar w-full">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Digits</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Call SID</TableHead>
              <TableHead>Ticket</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No IVRS calls yet. Configure your IVRS provider to POST to the webhook in Settings.</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd MMM yyyy, HH:mm:ss")}</TableCell>
                <TableCell className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /> {r.caller_phone || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono">{r.digits || "—"}</Badge></TableCell>
                <TableCell>{r.issue_type || "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.call_sid || "—"}</TableCell>
                <TableCell className="text-xs">{r.complaint_id ? <Badge>linked</Badge> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}
