import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const bodySchema = z.object({
  order_id: z.string().uuid(),
  station: z.string().max(60).optional(),
  note: z.string().max(500).optional(),
});

function authorize(request: Request) {
  const token = process.env["KITCHEN_API_TOKEN"];
  const header = request.headers.get("authorization") ?? "";
  if (!token || header !== `Bearer ${token}`) return false;
  return true;
}

function admin() {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const Route = createFileRoute("/api/public/kitchen/dispatch")({
  server: {
    handlers: {
      // ส่งออเดอร์เข้าครัวจากระบบภายนอก (POS / เครื่องพิมพ์ครัว)
      POST: async ({ request }) => {
        if (!authorize(request)) return new Response("Unauthorized", { status: 401 });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });

        const supabase = admin();
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("id")
          .eq("id", parsed.data.order_id)
          .maybeSingle();
        if (orderError) return new Response("Database error", { status: 500 });
        if (!order) return new Response("Order not found", { status: 404 });

        const { data: ticket, error } = await supabase
          .from("kitchen_tickets")
          .insert({
            order_id: parsed.data.order_id,
            station: parsed.data.station ?? "main",
            note: parsed.data.note ?? "",
            channel: "api",
            status: "sent",
          })
          .select()
          .single();
        if (error) return new Response("Database error", { status: 500 });

        await supabase.from("orders").update({ status: "in_kitchen" }).eq("id", parsed.data.order_id);
        return Response.json({ ok: true, ticket });
      },

      // ให้จอครัว/ระบบภายนอกดึงใบสั่งที่ยังไม่เสร็จ
      GET: async ({ request }) => {
        if (!authorize(request)) return new Response("Unauthorized", { status: 401 });
        const supabase = admin();
        const { data, error } = await supabase
          .from("kitchen_tickets")
          .select("id, order_id, station, channel, status, note, sent_at, received_at")
          .in("status", ["sent", "received", "cooking"])
          .order("sent_at", { ascending: true })
          .limit(100);
        if (error) return new Response("Database error", { status: 500 });
        return Response.json({ tickets: data ?? [] });
      },
    },
  },
});
