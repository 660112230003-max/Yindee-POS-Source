import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const botToken = String(body?.botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
          const chatId = String(body?.chatId || process.env.TELEGRAM_CHAT_ID || "").trim();
          const text = String(body?.text || "").trim();

          if (!botToken || !chatId || !text) {
            return Response.json(
              { success: false, error: "Missing botToken, chatId, or text" },
              { status: 400 }
            );
          }

          const telegramRes = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: text,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          });

          const data = await telegramRes.json().catch(() => ({}));
          if (!telegramRes.ok || !data.ok) {
            return Response.json(
              { success: false, error: data.description || "Telegram API Error" },
              { status: telegramRes.status || 500 }
            );
          }

          return Response.json({ success: true, messageId: data.result?.message_id });
        } catch (error: any) {
          console.error("[API /api/telegram/send] Error:", error);
          return Response.json(
            { success: false, error: error?.message || "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
