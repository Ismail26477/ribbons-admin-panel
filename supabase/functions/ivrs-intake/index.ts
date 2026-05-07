// IVRS intake — accepts JSON or form-data POSTs from any IVRS provider.
// Public endpoint (verify_jwt=false). Optional X-IVRS-Key header check vs app_settings.ivrs_api_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ivrs-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ISSUE_MAP: Record<string, string> = {
  "1": "Installation",
  "2": "Repair",
  "3": "Maintenance",
  "4": "Service",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optional API key gate
    const { data: settings } = await supabase.from("app_settings").select("ivrs_api_key").eq("id", 1).maybeSingle();
    const expectedKey = settings?.ivrs_api_key;
    if (expectedKey) {
      const provided = req.headers.get("x-ivrs-key");
      if (provided !== expectedKey) {
        return new Response(JSON.stringify({ error: "invalid api key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Parse body (JSON or form)
    const ct = req.headers.get("content-type") || "";
    let payload: Record<string, unknown> = {};
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const fd = await req.formData();
      fd.forEach((v, k) => (payload[k] = String(v)));
    }

    const callSid = String(payload.CallSid ?? payload.call_sid ?? payload.uuid ?? "");
    const phone = String(payload.From ?? payload.from ?? payload.caller ?? payload.phone ?? payload.customer_phone ?? "");
    const digits = String(payload.Digits ?? payload.digits ?? payload.input ?? "");
    const explicitIssue = payload.issue_type ? String(payload.issue_type) : null;
    const issueType = explicitIssue || ISSUE_MAP[digits] || "General";
    const priorityRaw = String(payload.priority ?? "normal").toLowerCase();
    const priority = (["low", "normal", "high", "urgent"].includes(priorityRaw) ? priorityRaw : "normal") as
      "low" | "normal" | "high" | "urgent";
    const customerName = payload.customer_name ? String(payload.customer_name) : null;
    const customerAddress = payload.customer_address ? String(payload.customer_address) : null;
    const description = payload.description
      ? String(payload.description)
      : `IVRS call. Digits: ${digits || "n/a"}`;

    if (!phone) {
      return new Response(JSON.stringify({ error: "phone required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick the most-specific matching rule BEFORE creating the complaint.
    // Specificity ranking (low number wins):
    //   1 = issue + priority both match
    //   2 = issue matches, rule priority is null (any)
    //   3 = priority matches, rule issue is null (any)
    //   4 = both null (catch-all)
    // Within the same specificity bucket, lower sort_order wins.
    const { data: rules } = await supabase
      .from("assignment_rules")
      .select("id, issue_type, priority, technician_id, sort_order")
      .eq("active", true);

    let assignedTechId: string | null = null;
    if (rules?.length) {
      const scored = rules
        .map((r) => {
          const issueMatch = r.issue_type ? r.issue_type.toLowerCase() === issueType.toLowerCase() : null;
          const prioMatch = r.priority ? r.priority === priority : null;
          if (issueMatch === false || prioMatch === false) return null;
          let rank = 4;
          if (issueMatch === true && prioMatch === true) rank = 1;
          else if (issueMatch === true && prioMatch === null) rank = 2;
          else if (issueMatch === null && prioMatch === true) rank = 3;
          return { ...r, rank };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => a.rank - b.rank || (a.sort_order ?? 999) - (b.sort_order ?? 999));
      if (scored.length > 0) assignedTechId = scored[0].technician_id;
    }

    // Create complaint (with auto-assignment baked in)
    const { data: complaint, error: cErr } = await supabase
      .from("complaints")
      .insert({
        customer_phone: phone,
        customer_name: customerName,
        customer_address: customerAddress,
        issue_type: issueType,
        description,
        source: "ivrs",
        priority,
        status: assignedTechId ? "assigned" : "pending",
        technician_id: assignedTechId,
      })
      .select()
      .single();
    if (cErr) throw cErr;

    // Log the call
    await supabase.from("ivrs_call_logs").insert({
      call_sid: callSid || null,
      caller_phone: phone,
      digits: digits || null,
      issue_type: issueType,
      raw_payload: payload as never,
      complaint_id: complaint.id,
    });

    // (Notifications are emitted automatically by DB triggers on complaints.)

    return new Response(
      JSON.stringify({ ok: true, ticket_no: complaint.ticket_no, complaint_id: complaint.id, assigned: !!assignedTechId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ivrs-intake error", err);
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
