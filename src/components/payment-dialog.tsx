import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABEL,
  baht,
  fetchUnpaidOrders,
  payOrder,
  type Order,
  type PaymentMethod,
} from "@/lib/restaurant";

const METHODS: { value: PaymentMethod; icon: typeof Banknote }[] = [
  { value: "cash", icon: Banknote },
  { value: "transfer", icon: QrCode },
  { value: "card", icon: CreditCard },
];

const QUICK_CASH = [20, 50, 100, 500, 1000];

export function PaymentDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["unpaid-orders"],
    queryFn: fetchUnpaidOrders,
    refetchInterval: 15000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const order = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );
  const due = Number(order?.final_amount ?? 0);
  const change = method === "cash" ? received - due : 0;
  const enough = method !== "cash" || received + 0.001 >= due;

  const pick = (o: Order) => {
    setSelectedId(o.id);
    setMethod("cash");
    setReceived(0);
    setNote("");
  };

  const submit = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await payOrder({ order, method, amountReceived: received, note });
      toast.success(
        `รับชำระเงินสำเร็จ · ${order.order_number}` +
          (method === "cash" && change > 0 ? ` · เงินทอน ${baht(change)}` : ""),
      );
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["unpaid-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "รับชำระเงินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="ชำระเงิน / แคชเชียร์" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            ออเดอร์ที่รอชำระ ({orders.length})
          </p>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}
            {!isLoading && orders.length === 0 && (
              <p className="text-sm text-muted-foreground">ไม่มีออเดอร์ที่รอชำระเงิน</p>
            )}
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => pick(o)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  selectedId === o.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/40",
                )}
              >
                <p className="truncate text-sm font-bold">{o.order_number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {o.order_type === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน"}
                  {o.customer_name ? ` · ${o.customer_name}` : ""}
                </p>
                <p className="mt-1 text-sm font-bold text-primary">{baht(o.final_amount)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          {!order && (
            <div className="grid h-full min-h-40 place-items-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              เลือกออเดอร์ทางซ้ายเพื่อรับชำระเงิน
            </div>
          )}

          {order && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/60 p-3">
                <div className="max-h-32 space-y-1 overflow-y-auto text-sm">
                  {(order.order_items ?? []).map((it) => (
                    <div key={it.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {it.menu_name} × {it.quantity}
                      </span>
                      <span className="shrink-0 font-medium">{baht(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-bold">
                  <span>ยอดที่ต้องชำระ</span>
                  <span className="text-primary">{baht(due)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors",
                        method === m.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {PAYMENT_METHOD_LABEL[m.value]}
                    </button>
                  );
                })}
              </div>

              {method === "cash" && (
                <div className="space-y-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">รับเงินมา (บาท)</span>
                    <input
                      type="number"
                      min={0}
                      value={received || ""}
                      onChange={(e) => setReceived(Number(e.target.value) || 0)}
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base font-bold outline-none focus:border-primary"
                      placeholder="0"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setReceived(due)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50"
                    >
                      พอดี {baht(due)}
                    </button>
                    {QUICK_CASH.map((v) => (
                      <button
                        key={v}
                        onClick={() => setReceived((r) => r + v)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50"
                      >
                        +{v}
                      </button>
                    ))}
                    <button
                      onClick={() => setReceived(0)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/50"
                    >
                      ล้าง
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm font-bold">
                    <span>เงินทอน</span>
                    <span className={cn(change < 0 ? "text-muted-foreground" : "text-secondary")}>
                      {baht(Math.max(0, change))}
                    </span>
                  </div>
                </div>
              )}

              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">หมายเหตุ</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น เลขอ้างอิงการโอน"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <button
                onClick={submit}
                disabled={saving || !enough}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Wallet className="h-4 w-4" />
                {enough ? `รับชำระ ${baht(due)}` : "รับเงินไม่พอ"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
