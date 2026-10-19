import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { baht } from "@/lib/restaurant";
import { PROMPTPAY_ID } from "@/lib/promptpay";

interface PromptPayBillingSectionProps {
  amount: number;
  table: string;
  onPaymentSuccess: (method: "auto" | "manual") => void;
  isProcessingCheckout?: boolean;
}

export function PromptPayBillingSection({
  amount,
  table,
  onPaymentSuccess,
  isProcessingCheckout = false,
}: PromptPayBillingSectionProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Countdown timer: 5 minutes (300 seconds)
  const INITIAL_COUNTDOWN = 5 * 60;
  const [timeLeft, setTimeLeft] = useState<number>(INITIAL_COUNTDOWN);
  const [isExpired, setIsExpired] = useState(false);

  // Status tracking
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "PAID">("PENDING");
  const [simulating, setSimulating] = useState(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Stop countdown helper
  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // 1. Fetch QR Code from API
  const generateQrCode = useCallback(async () => {
    setLoading(true);
    setNetworkError(null);
    setIsExpired(false);
    setTimeLeft(INITIAL_COUNTDOWN);
    stopPolling();
    stopCountdown();

    try {
      // Try /api/generate-qr first, fallback to /api/payment/qr
      let response: Response;
      try {
        response = await fetch("/api/generate-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, table }),
        });
      } catch {
        response = await fetch("/api/payment/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, table }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (!data.qrCodeUrl) {
        throw new Error("ไม่พบรูป QR Code ในข้อมูลตอบกลับ");
      }

      if (isMountedRef.current) {
        setQrCodeUrl(data.qrCodeUrl);
        setPaymentStatus("PENDING");
      }
    } catch (err) {
      console.error("Network or QR generation error:", err);
      if (isMountedRef.current) {
        setNetworkError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อสร้าง QR Code ได้"
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [amount, table, INITIAL_COUNTDOWN, stopPolling, stopCountdown]);

  // Initial QR fetch when mounted or amount/table changes
  useEffect(() => {
    isMountedRef.current = true;
    generateQrCode();

    return () => {
      isMountedRef.current = false;
      stopPolling();
      stopCountdown();
    };
  }, [generateQrCode, stopPolling, stopCountdown]);

  // 2. Countdown Timer Effect (5 minutes)
  useEffect(() => {
    if (loading || networkError || isExpired || !qrCodeUrl) return;

    countdownTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopCountdown();
          stopPolling();
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      stopCountdown();
    };
  }, [loading, networkError, isExpired, qrCodeUrl, stopCountdown, stopPolling]);

  // 3. Polling Status Effect (every 3 seconds)
  useEffect(() => {
    if (loading || networkError || isExpired || !qrCodeUrl) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/payment/status/${encodeURIComponent(table)}`);
        if (!res.ok) return; // Silent ignore network blip during polling

        const data = await res.json();
        if (data.status === "PAID") {
          stopPolling();
          stopCountdown();
          setPaymentStatus("PAID");
          onPaymentSuccess("auto");
        }
      } catch (err) {
        // Polling network blip - don't crash UI, keep retrying
        console.debug("Status polling network ping failed (will retry):", err);
      }
    };

    pollingTimerRef.current = setInterval(checkStatus, 3000);

    return () => {
      stopPolling();
    };
  }, [loading, networkError, isExpired, qrCodeUrl, table, onPaymentSuccess, stopPolling, stopCountdown]);

  // Format mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Simulate mock payment for testing
  const handleSimulateMockPay = async () => {
    setSimulating(true);
    try {
      await fetch("/api/payment/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table }),
      });
    } catch (err) {
      console.warn("Mock pay error:", err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 via-background to-background p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-200 shadow-sm">
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs shadow-sm">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-foreground">
                พร้อมเพย์ (PromptPay QR)
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> ระบุยอดตรง
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              เบอร์พร้อมเพย์ร้าน: <span className="font-mono font-semibold">{PROMPTPAY_ID}</span> · โต๊ะ {table}
            </p>
          </div>
        </div>

        {/* Live Amount Pill */}
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">ยอดชำระ</p>
          <p className="text-base font-black text-primary leading-tight">{baht(amount)}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex flex-col items-center justify-center min-h-[260px] rounded-xl border border-border/60 bg-card p-4">
        {/* State 1: Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-medium">กำลังสร้าง PromptPay QR Code ระบุยอดเงิน...</p>
          </div>
        )}

        {/* State 2: Network / Fetch Error */}
        {!loading && networkError && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center max-w-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                เกิดข้อผิดพลาดในการโหลด QR Code
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{networkError}</p>
            </div>
            <button
              type="button"
              onClick={generateQrCode}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold hover:bg-muted active:scale-95 transition-all shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {/* State 3: QR Code Expired (After 5 Minutes) */}
        {!loading && !networkError && isExpired && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center max-w-xs animate-in fade-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                QR Code หมดอายุแล้ว (ครบ 5 นาที)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                เพื่อความปลอดภัยในการทำธุรกรรม กรุณากดสร้าง QR Code ใหม่
              </p>
            </div>
            <button
              type="button"
              onClick={generateQrCode}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-glow hover:bg-primary/95 active:scale-95 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> สร้าง QR Code ใหม่ (Regenerate)
            </button>
          </div>
        )}

        {/* State 4: Active QR Code */}
        {!loading && !networkError && !isExpired && qrCodeUrl && (
          <div className="flex flex-col items-center gap-3 w-full animate-in zoom-in-95 duration-200">
            {/* QR Card with PromptPay banner */}
            <div className="relative rounded-2xl bg-white p-3 shadow-md border border-slate-200 flex flex-col items-center">
              {/* PromptPay stylized header */}
              <div className="w-full bg-[#113566] text-white py-1 px-3 rounded-lg text-center mb-2 flex items-center justify-center gap-1.5">
                <span className="font-black tracking-wider text-[11px]">THAI QR PAYMENT</span>
              </div>

              {/* QR Image */}
              <img
                src={qrCodeUrl}
                alt={`PromptPay QR ยอด ${amount} บาท`}
                className="h-44 w-44 object-contain rounded-lg transition-transform hover:scale-105 duration-200"
              />

              {/* PromptPay sub-label */}
              <div className="mt-1 text-center">
                <p className="text-[11px] font-bold text-slate-800">
                  สแกนจ่ายผ่าน Mobile Banking ทุกธนาคาร
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  ยอดเงินถูกล็อกอัตโนมัติที่ <span className="font-bold text-primary">{baht(amount)}</span>
                </p>
              </div>
            </div>

            {/* Countdown Timer & Polling Indicator */}
            <div className="flex items-center justify-between w-full max-w-[260px] px-1 text-xs">
              <div
                className={`flex items-center gap-1.5 font-mono font-bold ${
                  timeLeft <= 60
                    ? "text-rose-600 animate-pulse"
                    : "text-muted-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>หมดอายุใน {formatTime(timeLeft)}</span>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>รอรับยอด...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons Below QR Code */}
      <div className="space-y-2 pt-1">
        {/* Button 1: Manual Confirm (Frontend Requirement 3 & 4) */}
        <button
          type="button"
          onClick={() => onPaymentSuccess("manual")}
          disabled={isProcessingCheckout || loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] py-3 text-sm font-bold text-white shadow-md transition-all disabled:opacity-50"
        >
          {isProcessingCheckout ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>กำลังบันทึกและสั่งพิมพ์...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>ยืนยันรับชำระเงินแล้ว (ตรวจสลิปเรียบร้อย)</span>
            </>
          )}
        </button>

        {/* Developer / Demo Simulator Button (Simulate scan payment) */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={generateQrCode}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-semibold text-muted-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> สร้าง QR ใหม่
          </button>

          <button
            type="button"
            onClick={handleSimulateMockPay}
            disabled={simulating || paymentStatus === "PAID"}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-[11px] font-bold text-primary transition-colors disabled:opacity-50"
            title="จำลองสถานการณ์ลูกค้าสแกนจ่ายเงินผ่าน Mobile Banking สำเร็จ"
          >
            <Sparkles className="h-3 w-3" />
            {simulating ? "กำลังจำลอง..." : "⚡ จำลองลูกค้าสแกนจ่าย"}
          </button>
        </div>
      </div>
    </div>
  );
}
