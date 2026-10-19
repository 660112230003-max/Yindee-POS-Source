/**
 * Node.js & Express Payment Server for Yindee Moo Krob POS
 *
 * Requirements:
 * 1. PROMPTPAY_ID constant = "0809811378"
 * 2. POST /api/generate-qr & POST /api/payment/qr (amount, table)
 * 3. EMVCo Payload via promptpay-qr
 * 4. Base64 Image via qrcode
 * 5. GET /api/payment/status/:table (PENDING / PAID)
 */

import express from "express";
import cors from "cors";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

const app = express();
const PORT = process.env.PAYMENT_PORT || 3001;

// 1. กำหนดตัวแปรคงที่เป็นหมายเลขพร้อมเพย์ของร้าน
export const PROMPTPAY_ID = process.env.PROMPTPAY_ID || "0809811378";

app.use(cors());
app.use(express.json());

// In-memory payment status storage
const paymentStatusStore = new Map();

/**
 * ฟังก์ชันสร้าง QR Code
 */
async function generatePromptPayData(amount, table = "counter") {
  const num = Number(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error("Invalid amount");
  }

  // 3. ใช้ promptpay-qr สร้าง EMVCo Payload
  const payload = generatePayload(PROMPTPAY_ID, { amount: num });

  // 4. ใช้ qrcode แปลง Payload เป็น Base64 Image URL
  const qrCodeUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000;

  paymentStatusStore.set(table, {
    table,
    amount: num,
    status: "PENDING",
    expiresAt,
    createdAt: now,
  });

  return {
    success: true,
    qrCodeUrl,
    payload,
    amount: num,
    promptpayId: PROMPTPAY_ID,
    table,
    expiresAt,
  };
}

// 2. Endpoint POST /api/generate-qr
app.post("/api/generate-qr", async (req, res) => {
  try {
    const { amount, table } = req.body;
    const result = await generatePromptPayData(amount, table);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || "Cannot generate QR" });
  }
});

// Alias: POST /api/payment/qr
app.post("/api/payment/qr", async (req, res) => {
  try {
    const { amount, table } = req.body;
    const result = await generatePromptPayData(amount, table);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || "Cannot generate QR" });
  }
});

// Mock Endpoint GET /api/payment/status/:table
app.get("/api/payment/status/:table", (req, res) => {
  const { table } = req.params;
  const record = paymentStatusStore.get(table);

  if (!record) {
    return res.json({
      table,
      status: "PENDING",
      isExpired: false,
    });
  }

  const isExpired = Date.now() > record.expiresAt;
  res.json({
    table,
    status: record.status,
    amount: record.amount,
    isExpired,
    expiresAt: record.expiresAt,
  });
});

// Mock simulation endpoint: POST /api/payment/mock-pay
app.post("/api/payment/mock-pay", (req, res) => {
  const { table } = req.body;
  if (!table) return res.status(400).json({ error: "Missing table" });

  const record = paymentStatusStore.get(table) || { table };
  record.status = "PAID";
  paymentStatusStore.set(table, record);

  res.json({
    success: true,
    table,
    status: "PAID",
    message: `Payment status for ${table} updated to PAID`,
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, promptpayId: PROMPTPAY_ID });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[Express Payment Server] Running at http://localhost:${PORT}`);
    console.log(`[PromptPay ID] ${PROMPTPAY_ID}`);
  });
}

export default app;
