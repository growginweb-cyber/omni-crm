import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TRANSPARENT_PIXEL = Uint8Array.from(
  atob(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
  ),
  (c) => c.charCodeAt(0)
);

serve(async (req: Request) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("t"); // "open" or "click"
  const tenantId = url.searchParams.get("tid");
  const customerId = url.searchParams.get("cid");
  const taskId = url.searchParams.get("bid");
  const queueId = url.searchParams.get("qid");
  const stepQueueId = url.searchParams.get("sid");
  const channel = url.searchParams.get("ch") || "Email";
  const redirectUrl = url.searchParams.get("url");

  if (!type || !tenantId) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("tracking_events").insert({
      tenant_id: tenantId,
      customer_id: customerId || null,
      broadcast_task_id: taskId || null,
      broadcast_queue_id: queueId || null,
      step_queue_id: stepQueueId || null,
      event_type: type === "click" ? "click" : "open",
      delivery_channel: channel,
      url: redirectUrl || null,
      user_agent: req.headers.get("user-agent") || null,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] || null,
    });

    if (taskId) {
      const countCol =
        type === "click" ? "clicked_count" : "opened_count";
      await supabase.rpc("increment_counter", {
        table_name: "broadcast_tasks",
        row_id: taskId,
        column_name: countCol,
      });
    }
  } catch (e) {
    console.error("Tracking error:", e);
  }

  if (type === "click" && redirectUrl) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
});
