import { createFileRoute } from "@tanstack/react-router";
import { getPaymentStatus, markPaymentAsPaid } from "@/lib/promptpay";

export const Route = createFileRoute("/api/payment/status/$table")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const table = params.table;
        const url = new URL(request.url);

        // Support ?simulate=paid query param for immediate browser-based testing
        if (url.searchParams.get("simulate") === "paid") {
          markPaymentAsPaid(table);
        }

        const info = getPaymentStatus(table);
        return Response.json({
          table,
          status: info.status,
          isExpired: info.isExpired,
          amount: info.record?.amount,
          expiresAt: info.record?.expiresAt,
        });
      },
    },
  },
});
