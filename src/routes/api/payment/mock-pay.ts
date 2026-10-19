import { createFileRoute } from "@tanstack/react-router";
import { markPaymentAsPaid } from "@/lib/promptpay";

export const Route = createFileRoute("/api/payment/mock-pay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const table = String(body?.table || "counter");
        markPaymentAsPaid(table);
        return Response.json({
          success: true,
          table,
          status: "PAID",
          message: `Simulated payment marked as PAID for ${table}`,
        });
      },
    },
  },
});
