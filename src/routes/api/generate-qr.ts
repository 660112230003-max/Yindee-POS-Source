import { createFileRoute } from "@tanstack/react-router";
import { createPromptPayQR } from "@/lib/promptpay";

export const Route = createFileRoute("/api/generate-qr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const amount = Number(body?.amount);
          const table = String(body?.table || "counter");

          if (!amount || isNaN(amount) || amount <= 0) {
            return Response.json(
              { error: "Invalid amount. ยอดเงินต้องมากกว่า 0 บาท" },
              { status: 400 }
            );
          }

          const qrData = await createPromptPayQR(amount, table);

          return Response.json({
            success: true,
            qrCodeUrl: qrData.qrCodeUrl,
            payload: qrData.payload,
            amount: qrData.amount,
            promptpayId: qrData.promptpayId,
            table: qrData.table,
            expiresAt: qrData.expiresAt,
          });
        } catch (error) {
          console.error("Generate QR Error:", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to generate QR Code" },
            { status: 500 }
          );
        }
      },
    },
  },
});
