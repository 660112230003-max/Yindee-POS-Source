import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/**
 * ร้านยินดีหมูกรอบ PromptPay Configuration
 */
export const PROMPTPAY_ID = process.env["PROMPTPAY_ID"] || "0809811378";

export interface GenerateQrResult {
  qrCodeUrl: string; // Base64 Data URL
  payload: string;   // EMVCo PromptPay Payload string
  amount: number;
  promptpayId: string;
  table?: string;
  createdAt: number;
  expiresAt: number; // 5 minutes expiry
}

export interface PaymentRecord {
  table: string;
  amount: number;
  status: "PENDING" | "PAID";
  qrCodeUrl: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory payment store for polling / status tracking
const paymentStore = new Map<string, PaymentRecord>();

/**
 * สร้าง Dynamic PromptPay QR Code
 * @param amount ยอดเงิน
 * @param table เลขโต๊ะ (optional)
 */
export async function createPromptPayQR(
  amount: number,
  table: string = "counter"
): Promise<GenerateQrResult> {
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid amount: ยอดเงินต้องมากกว่า 0 บาท");
  }

  // 1. สร้าง EMVCo Payload ผ่าน promptpay-qr
  const payload = generatePayload(PROMPTPAY_ID, { amount: numericAmount });

  // 2. แปลงเป็น Data URL (Base64) ผ่าน qrcode
  const qrCodeUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#0f172a", // Dark slate
      light: "#ffffff",
    },
  });

  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 นาที (300,000 ms)

  const record: PaymentRecord = {
    table,
    amount: numericAmount,
    status: "PENDING",
    qrCodeUrl,
    createdAt: now,
    expiresAt,
  };

  paymentStore.set(table, record);

  return {
    qrCodeUrl,
    payload,
    amount: numericAmount,
    promptpayId: PROMPTPAY_ID,
    table,
    createdAt: now,
    expiresAt,
  };
}

export function getPaymentStatus(table: string): { status: "PENDING" | "PAID"; isExpired: boolean; record?: PaymentRecord } {
  const record = paymentStore.get(table);
  if (!record) {
    return { status: "PENDING", isExpired: false };
  }
  const isExpired = Date.now() > record.expiresAt;
  return {
    status: record.status,
    isExpired,
    record,
  };
}

export function markPaymentAsPaid(table: string): boolean {
  const record = paymentStore.get(table);
  if (record) {
    record.status = "PAID";
    return true;
  }
  paymentStore.set(table, {
    table,
    amount: 0,
    status: "PAID",
    qrCodeUrl: "",
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return true;
}
