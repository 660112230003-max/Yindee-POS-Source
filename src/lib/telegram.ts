/**
 * Telegram Notification Service for Yindee Moo Krob POS
 * Sends real-time notifications to Telegram when customers call waitstaff or request bills.
 */

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  kitchenChatId?: string;
  enabled: boolean;
}

export interface TelegramServiceAlertOptions {
  tableId?: string;
  tableCode?: string;
  tableName?: string;
  zone?: string;
  message: string;
  callId?: string;
  createdAt?: string;
  isBillCall?: boolean;
}

export interface TelegramKitchenReadyOptions {
  ticketId?: string;
  orderNumber?: string;
  tableName?: string;
  tableCode?: string;
  zone?: string;
  isTakeaway?: boolean;
  items?: { name: string; quantity: number }[];
  note?: string;
  station?: string;
  createdAt?: string;
}

const STORAGE_KEY = "pos_telegram_settings";

/**
 * Get locally cached Telegram configuration from localStorage (fallback/offline/dev)
 */
export function getLocalTelegramConfig(): Partial<TelegramConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("[Telegram] Error reading local config:", e);
  }
  return {};
}

/**
 * Save Telegram configuration to localStorage
 */
export function saveLocalTelegramConfig(config: Partial<TelegramConfig>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn("[Telegram] Error saving local config:", e);
  }
}

/**
 * Resolve the effective Telegram config from DB settings, localStorage, and environment variables
 */
export function resolveTelegramConfig(settings?: {
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_kitchen_chat_id?: string | null;
  telegram_notify_enabled?: boolean | null;
}): TelegramConfig {
  const local = getLocalTelegramConfig();
  const envToken =
    (typeof process !== "undefined" ? process.env?.TELEGRAM_BOT_TOKEN : "") ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_TELEGRAM_BOT_TOKEN
      ? String(import.meta.env.VITE_TELEGRAM_BOT_TOKEN)
      : "") ||
    "";
  const envChatId =
    (typeof process !== "undefined" ? process.env?.TELEGRAM_CHAT_ID : "") ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_TELEGRAM_CHAT_ID
      ? String(import.meta.env.VITE_TELEGRAM_CHAT_ID)
      : "") ||
    "";
  const envKitchenChatId =
    (typeof process !== "undefined" ? process.env?.TELEGRAM_KITCHEN_CHAT_ID : "") ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_TELEGRAM_KITCHEN_CHAT_ID
      ? String(import.meta.env.VITE_TELEGRAM_KITCHEN_CHAT_ID)
      : "") ||
    "";

  const botToken = settings?.telegram_bot_token || local.botToken || envToken || "";
  const chatId = settings?.telegram_chat_id || local.chatId || envChatId || "";
  const kitchenChatId =
    settings?.telegram_kitchen_chat_id || local.kitchenChatId || envKitchenChatId || "";
  const enabled = settings?.telegram_notify_enabled ?? local.enabled ?? true;

  return {
    botToken: botToken.trim(),
    chatId: chatId.trim(),
    kitchenChatId: kitchenChatId.trim(),
    enabled: Boolean(enabled),
  };
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
export function escapeTelegramHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Format a timestamp into Thai date and time string (Bangkok timezone)
 */
export function formatThaiDateTime(dateOrStr?: string | Date): string {
  const date = dateOrStr
    ? typeof dateOrStr === "string"
      ? new Date(dateOrStr)
      : dateOrStr
    : new Date();
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Asia/Bangkok",
    }).format(date);
  } catch {
    return date.toLocaleTimeString("th-TH");
  }
}

/**
 * Send a raw Telegram message via Bot API
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  htmlText: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!botToken) return { success: false, error: "ยังไม่ได้ระบุ Telegram Bot Token" };
  if (!chatId) return { success: false, error: "ยังไม่ได้ระบุ Telegram Chat ID" };

  const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      let desc = json.description || ("HTTP " + res.status);
      if (res.status === 401 || desc.toLowerCase().includes("unauthorized")) {
        desc = "Bot Token ไม่ถูกต้อง (กรุณาตรวจสอบ Token จาก @BotFather)";
      } else if (desc.toLowerCase().includes("chat not found")) {
        desc = "ไม่พบ Chat ID (กรุณาพิมพ์ /start คุยกับบอท หรือดึงบอทเข้ากลุ่มก่อน)";
      } else if (desc.toLowerCase().includes("bot was blocked")) {
        desc = "บอทถูกบล็อกในแชท กรุณาปลดบล็อกบอทใน Telegram";
      }
      return { success: false, error: desc };
    }

    return { success: true, messageId: json.result?.message_id };
  } catch (err: any) {
    return { success: false, error: err?.message || "ไม่สามารถเชื่อมต่อ Telegram API ได้" };
  }
}

/**
 * Send a test notification to verify Bot Token and Chat ID
 */
export async function testTelegramNotification(
  botToken: string,
  chatId: string,
  storeName = "ยินดีหมูกรอบ"
): Promise<{ success: boolean; error?: string }> {
  const timeStr = formatThaiDateTime();
  const text = [
    "✅ <b>ทดสอบการเชื่อมต่อระบบแจ้งเตือนสำเร็จ!</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    `🏪 <b>ร้าน:</b> ${escapeTelegramHtml(storeName)}`,
    "🤖 <b>สถานะบอท:</b> พร้อมส่งแจ้งเตือนลูกค้าเรียกเด็กเสิร์ฟ &amp; เช็คบิล",
    `⏰ <b>เวลาทดสอบ:</b> ${timeStr}`,
    "━━━━━━━━━━━━━━━━━━━━",
    `🎉 <i>ระบบ ${escapeTelegramHtml(storeName)} POS เชื่อมต่อ Telegram เรียบร้อยแล้ว</i>`,
  ].join("\n");

  return sendTelegramMessage(botToken, chatId, text);
}

// In-memory cache to prevent duplicate alerts for the same service call within 2 minutes
const sentAlertIds = new Map<string, number>();

/**
 * Send a notification when a customer calls the waiter or requests a bill
 */
export async function sendTelegramServiceAlert(
  options: TelegramServiceAlertOptions,
  configOverride?: Partial<TelegramConfig>
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  // Prevent duplicate sends for the same call
  if (options.callId) {
    const lastSent = sentAlertIds.get(options.callId);
    if (lastSent && Date.now() - lastSent < 120000) {
      return { success: true, skipped: true };
    }
  }

  // Load config
  let config: TelegramConfig;
  if (configOverride?.botToken && configOverride?.chatId) {
    config = {
      botToken: configOverride.botToken.trim(),
      chatId: configOverride.chatId.trim(),
      enabled: configOverride.enabled ?? true,
    };
  } else {
    config = resolveTelegramConfig();
  }

  if (!config.enabled) {
    return { success: false, skipped: true, error: "การแจ้งเตือน Telegram ถูกปิดไว้" };
  }

  if (!config.botToken || !config.chatId) {
    return { success: false, skipped: true, error: "ยังไม่ได้ตั้งค่า Telegram Bot Token หรือ Chat ID" };
  }

  const isBill =
    options.isBillCall ||
    options.message === "เรียกเช็คบิล" ||
    options.message.includes("เช็คบิล");
  const tableName =
    options.tableName || (options.tableCode ? `โต๊ะ ${options.tableCode}` : "มีลูกค้าเรียก");
  const timeStr = formatThaiDateTime(options.createdAt);
  const zoneStr = options.zone
    ? options.zone === "indoor"
      ? "ห้องแอร์"
      : options.zone === "terrace"
      ? "ระเบียง/ภายนอก"
      : options.zone
    : "";

  let text: string;
  if (isBill) {
    text = [
      "🧾🧾🧾 <b>【 แจ้งเตือน: ลูกค้าเรียกเช็คบิล! 】</b> 🧾🧾🧾",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      `🍽 <b>โต๊ะ:</b> <b>${escapeTelegramHtml(tableName)}</b> ${zoneStr ? `<i>[${escapeTelegramHtml(zoneStr)}]</i>` : ""}`,
      "💬 <b>ความต้องการ:</b> <b>ขอเช็คบิล</b>",
      `⏰ <b>เวลา:</b> ${timeStr}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      "⚡ <b>หน้าที่:</b> <i>แคชเชียร์หรือคนถือเครื่องรูด/เงินทอน รีบไปคิดเงินที่โต๊ะ</i>",
      "👉 <i>(กดอิโมจิ 👍 หรือ 🏃‍♂️ ที่ข้อความนี้ หากคุณกำลังเดินไป)</i>",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    text = [
      "🔔🔔🔔 <b>【 แจ้งเตือน: ลูกค้าเรียกพนักงาน! 】</b> 🔔🔔🔔",
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      `🍽 <b>โต๊ะ:</b> <b>${escapeTelegramHtml(tableName)}</b> ${zoneStr ? `<i>[${escapeTelegramHtml(zoneStr)}]</i>` : ""}`,
      "📢 <b>สิ่งที่ลูกค้าต้องการ:</b>",
      `👉 <b>${escapeTelegramHtml(options.message || "เรียกพนักงาน")}</b>`,
      `⏰ <b>เวลา:</b> ${timeStr}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━",
      "💡 <b>แนะนำ:</b> <i>หยิบของติดมือไปได้ตั้งแต่ก้าวแรก ไม่ต้องเดินไปถามก่อน</i>",
      "👉 <i>(กดอิโมจิ 🏃‍♂️ ที่ข้อความนี้ หากคุณกำลังไปดูแลโต๊ะนี้)</i>",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // 1. Try sending via internal API route (server-side, avoids adblockers)
  let result: { success: boolean; error?: string } | null = null;
  try {
    const apiRes = await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botToken: config.botToken,
        chatId: config.chatId,
        text,
      }),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.success) {
        result = { success: true };
      }
    }
  } catch {
    // API route failed or not supported in this context, fallback to direct fetch
  }

  // 2. If API route didn't succeed, fallback to direct Telegram Bot API fetch
  if (!result || !result.success) {
    result = await sendTelegramMessage(config.botToken, config.chatId, text);
  }

  if (result.success && options.callId) {
    sentAlertIds.set(options.callId, Date.now());
  }

  return result;
}

/**
 * Send a notification when the kitchen marks food as done/ready to serve
 */
export async function sendTelegramKitchenReadyAlert(
  options: TelegramKitchenReadyOptions,
  configOverride?: Partial<TelegramConfig>
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  if (options.ticketId) {
    const lastSent = sentAlertIds.get(`kitchen_${options.ticketId}`);
    if (lastSent && Date.now() - lastSent < 60000) {
      return { success: true, skipped: true };
    }
  }

  let config: TelegramConfig;
  if (configOverride?.botToken && configOverride?.chatId) {
    config = {
      botToken: configOverride.botToken.trim(),
      chatId: configOverride.chatId.trim(),
      enabled: configOverride.enabled ?? true,
    };
  } else {
    config = resolveTelegramConfig();
  }

  if (!config.enabled) {
    return { success: false, skipped: true, error: "การแจ้งเตือน Telegram ถูกปิดไว้" };
  }
  const targetChatId = config.kitchenChatId || config.chatId;

  if (!config.botToken || !targetChatId) {
    return { success: false, skipped: true, error: "ยังไม่ได้ตั้งค่า Telegram Bot Token หรือ Chat ID" };
  }

  const tableLabel = options.isTakeaway
    ? "🥡 สั่งกลับบ้าน (Takeaway)"
    : options.tableName || (options.tableCode ? `โต๊ะ ${options.tableCode}` : "มีออเดอร์พร้อมเสิร์ฟ");
  const timeStr = formatThaiDateTime(options.createdAt);
  const zoneStr = options.zone
    ? options.zone === "indoor"
      ? "ห้องแอร์"
      : options.zone === "terrace"
      ? "ระเบียง/ภายนอก"
      : options.zone
    : "";

  const itemsList = (options.items || [])
    .filter((it) => it.name)
    .map((it) => `  • <b>${escapeTelegramHtml(it.name)}</b> ×${it.quantity}`)
    .join("\n");

  const text = [
    "🍲🍲🍲 <b>【 แจ้งเตือน: ครัวทำอาหารเสร็จแล้ว (พร้อมเสิร์ฟ)! 】</b> 🍲🍲🍲",
    "━━━━━━━━━━━━━━━━━━━━━━━━",
    `🍽 <b>จุดส่งอาหาร:</b> <b>${escapeTelegramHtml(tableLabel)}</b> ${zoneStr && !options.isTakeaway ? `<i>[${escapeTelegramHtml(zoneStr)}]</i>` : ""}`,
    options.orderNumber ? `📋 <b>เลขออเดอร์:</b> <code>${escapeTelegramHtml(options.orderNumber)}</code>` : null,
    itemsList ? `\n🍱 <b>รายการที่เสร็จพร้อมเสิร์ฟ:</b>\n${itemsList}` : null,
    options.note ? `\n📝 <b>หมายเหตุ:</b> <i>${escapeTelegramHtml(options.note)}</i>` : null,
    `\n⏰ <b>เวลา:</b> ${timeStr}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━",
    "🏃‍♂️ <b>หน้าที่:</b> <i>อาหารปรุงเสร็จแล้ว รีบวิ่งไปหน้าครัวเพื่อนำไปส่งที่โต๊ะร้อนๆ</i>",
    "👉 <i>(กดอิโมจิ 🍲 หรือ 🏃‍♂️ ที่ข้อความนี้ เมื่อไปยกอาหารแล้ว)</i>",
  ]
    .filter(Boolean)
    .join("\n");

  let result: { success: boolean; error?: string } | null = null;
  try {
    const apiRes = await fetch("/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botToken: config.botToken,
        chatId: targetChatId,
        text,
      }),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.success) {
        result = { success: true };
      }
    }
  } catch {
    // API route failed or unavailable, proceed to direct fetch
  }

  if (!result || !result.success) {
    result = await sendTelegramMessage(config.botToken, targetChatId, text);
  }

  if (result.success && options.ticketId) {
    sentAlertIds.set(`kitchen_${options.ticketId}`, Date.now());
  }

  return result;
}
