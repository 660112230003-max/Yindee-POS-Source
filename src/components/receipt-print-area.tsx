import { useQuery } from "@tanstack/react-query";
import { baht, fetchSettings } from "@/lib/restaurant";

export interface ReceiptItem {
  id: string;
  menu_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface ReceiptData {
  title: string;
  code: string;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount?: number;
  paymentMethod: string;
  paymentNote?: string;
  items: ReceiptItem[];
  paidAt: string;
}

export function ReceiptPrintArea({ data }: { data: ReceiptData | null }) {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  if (!data) return null;

  const rawMethod = typeof data.paymentMethod === "string" ? data.paymentMethod : "cash";
  const itemsList = Array.isArray(data.items) ? data.items : [];

  const getMethodDisplay = (m: string) => {
    switch (m) {
      case "transfer":
        return "PromptPay QR (โอนเงิน)";
      case "card":
        return "บัตรเครดิต/เดบิต";
      case "cash":
        return "เงินสด";
      default:
        return m || "โอนเงิน";
    }
  };

  return (
    <div className="print-only print-area text-slate-900 font-mono text-xs max-w-[340px] mx-auto p-4 bg-white border border-dashed border-slate-300">
      {/* Header */}
      <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-3 mb-3">
        <h2 className="text-base font-black tracking-tight text-slate-950">
          {settings?.store_name || "ร้านยินดีหมูกรอบ"}
        </h2>
        <p className="text-[11px] text-slate-600">ใบเสร็จรับเงิน / Receipt (TAX INVOICE ABB)</p>
        <p className="text-[10px] text-slate-500">{settings?.tagline || "โทร. 080-981-1378"}</p>
      </div>

      {/* Bill Info */}
      <div className="space-y-1 border-b border-dashed border-slate-400 pb-2.5 mb-2.5 text-[11px]">
        <div className="flex justify-between">
          <span className="font-bold">{String(data.title || "บิล")}</span>
          <span>{String(data.paidAt || "")}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>ประเภท: {data.code === "Takeaway" ? "สั่งกลับบ้าน" : "รับประทานที่ร้าน"}</span>
          <span>แคชเชียร์: POS-01</span>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2 border-b border-dashed border-slate-400 pb-3 mb-3">
        <div className="flex justify-between font-bold text-[11px] text-slate-700">
          <span>รายการ</span>
          <span>จำนวนเงิน</span>
        </div>
        {itemsList.map((it, idx) => (
          <div key={`${it.id || idx}-${idx}`} className="flex justify-between items-start text-[11px]">
            <div className="pr-2">
              <div>{String(it.menu_name || "รายการอาหาร")}</div>
              <div className="text-[10px] text-slate-500">
                {Number(it.quantity || 1)} × {baht(it.unit_price || 0)}
              </div>
            </div>
            <span className="font-bold shrink-0">{baht(it.subtotal || 0)}</span>
          </div>
        ))}
      </div>

      {/* Calculations */}
      <div className="space-y-1.5 border-b border-dashed border-slate-400 pb-3 mb-3 text-[11px]">
        <div className="flex justify-between">
          <span>ยอดรวมค่าอาหาร</span>
          <span>{baht(data.subtotalAmount || 0)}</span>
        </div>
        {(Number(data.discountAmount) || 0) > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>ส่วนลด</span>
            <span>-{baht(data.discountAmount || 0)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-1.5 mt-1">
          <span>ยอดสุทธิ (Total)</span>
          <span className="text-base">{baht(data.totalAmount || 0)}</span>
        </div>
      </div>

      {/* Payment Information */}
      <div className="space-y-1 border-b border-dashed border-slate-400 pb-2.5 mb-3 text-[11px]">
        <div className="flex justify-between font-bold">
          <span>วิธีชำระเงิน</span>
          <span className="text-emerald-700">{getMethodDisplay(rawMethod)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>สถานะการชำระ</span>
          <span className="font-bold text-emerald-600">ชำระแล้ว (PAID)</span>
        </div>
        {data.paymentNote && (
          <div className="text-[10px] text-slate-500 truncate">
            อ้างอิง: {String(data.paymentNote)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-1 text-[10px] text-slate-500 space-y-0.5">
        <p className="font-semibold">ขอบคุณที่มาอุดหนุน{settings?.store_name ? ` ${settings.store_name} ` : ""}ครับ</p>
        <p>{settings?.hero_subtitle || "รสชาติต้นตำรับ กรอบนอกนุ่มใน ใส่ใจทุกขั้นตอน"}</p>
      </div>
    </div>
  );
}
