import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useRef } from "react";
import { BellRing, CheckCircle2, CheckSquare, ChefHat, Clock, Utensils, UtensilsCrossed, AlertCircle, X, Printer, RefreshCw, ReceiptText, Receipt, Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { ConsoleLayout, bento } from "@/components/console-layout";
import { Modal } from "@/components/modal";
import { PromptPayBillingSection } from "@/components/promptpay-billing-section";
import {
  baht,
  db,
  fetchOrders,
  fetchTables,
  fetchKitchenTickets,
  fetchServiceCalls,
  fetchCategories,
  fetchMenu,
  fetchSettings,
  isDrinkMenuItem,
  updateOrderStatus,
  dispatchToKitchen,
  resolveServiceCall,
  setKitchenTicketStatus,
  type OrderStatus,
  type RestaurantTable,
} from "@/lib/restaurant";
import { sendTelegramServiceAlert } from "@/lib/telegram";
import { playNotificationSound } from "@/lib/notification-sound";
import { StaffGuard } from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "พนักงานเสิร์ฟ · Restaurant OS" },
      { name: "description", content: "จัดการเสิร์ฟอาหารและรับออเดอร์" },
    ],
  }),
  component: StaffServingPage,
});

function StaffServingPage() {
  return (
    <StaffGuard pageTitle="พนักงานเสิร์ฟ">
      <StaffServingContent />
    </StaffGuard>
  );
}

function StaffServingContent() {
  const qc = useQueryClient();

  // Queries
  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: orders = [], refetch: refetchOrders, isFetching: fetchingOrders } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const { data: tickets = [], refetch: refetchTickets } = useQuery({ queryKey: ["kitchen-tickets"], queryFn: fetchKitchenTickets });
  const { data: calls = [], refetch: refetchCalls } = useQuery({
    queryKey: ["service-calls"],
    queryFn: fetchServiceCalls,
    refetchInterval: 3000,
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  const isTelegramActive = Boolean(
    settings?.telegram_bot_token &&
    settings?.telegram_chat_id &&
    settings?.telegram_notify_enabled !== false
  );

  const [resendingCallId, setResendingCallId] = useState<string | null>(null);

  const handleResendTelegram = async (callId: string, tableId: string, message: string) => {
    setResendingCallId(callId);
    try {
      const table = tables.find((t) => t.id === tableId);
      const tableName = table
        ? table.name
          ? `${table.name} (${table.code})`
          : `โต๊ะ ${table.code}`
        : "มีโต๊ะเรียก";
      const isBill = message === "เรียกเช็คบิล" || message.includes("เช็คบิล");
      const res = await sendTelegramServiceAlert(
        {
          tableId,
          tableName,
          zone: table?.zone,
          message,
          isBillCall: isBill,
        },
        settings
          ? {
              botToken: settings.telegram_bot_token || "",
              chatId: settings.telegram_chat_id || "",
              enabled: settings.telegram_notify_enabled ?? true,
            }
          : undefined
      );

      if (res.success) {
        toast.success(`📢 ส่งแจ้งเตือน ${tableName} เข้า Telegram เรียบร้อย`);
      } else {
        toast.error(`ส่งไม่สำเร็จ: ${res.error || "ตรวจสอบการตั้งค่า Telegram"}`);
      }
    } catch (err: any) {
      toast.error(`ข้อผิดพลาด: ${err?.message || "ส่งแจ้งเตือนไม่สำเร็จ"}`);
    } finally {
      setResendingCallId(null);
    }
  };

  // Force re-render for timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  // Track notified call IDs to prevent duplicate toasts
  const notifiedCallIdsRef = useRef<Set<string>>(new Set());
  const initialLoadedRef = useRef(false);

  const triggerServiceCallAlert = (callData: any) => {
    qc.invalidateQueries({ queryKey: ["service-calls"] });
    playNotificationSound();
    const msg = callData?.message ?? "";
    const tableId = callData?.table_id;
    const tableCode = callData?.table_code;
    const targetTable = tables.find((t) => t.id === tableId || t.code === tableCode);
    const tableName = targetTable ? `โต๊ะ ${targetTable.code}` : (tableCode ? `โต๊ะ ${tableCode}` : "มีโต๊ะ");

    if (msg === "เรียกเช็คบิล" || msg.includes("เช็คบิล")) {
      toast.warning(`🧾 ${tableName} เรียกเช็คบิล!`, {
        description: "ลูกค้าต้องการเช็คบิล กรุณาเตรียมพิมพ์บิลหรือไปเก็บเงินที่โต๊ะ",
        duration: 8000,
      });
    } else {
      toast.info(`🔔 ${tableName} เรียกพนักงาน`, {
        description: msg || "ลูกค้ากดเรียกพนักงาน",
        duration: 5000,
      });
    }
  };

  // Detect newly fetched calls via polling as a guaranteed fallback
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      const now = Date.now();
      // On initial load, alert any call that was created very recently (< 60s ago)
      // and mark the rest as known so we don't spam for historical calls
      calls.forEach((c) => {
        const ageMs = c.created_at ? now - new Date(c.created_at).getTime() : 999999;
        if (!c.resolved && ageMs < 60000) {
          notifiedCallIdsRef.current.add(c.id);
          triggerServiceCallAlert(c);
        } else {
          notifiedCallIdsRef.current.add(c.id);
        }
      });
      return;
    }

    // Subsequent polling updates: alert any new unresolved call
    calls.forEach((c) => {
      if (!c.resolved && !notifiedCallIdsRef.current.has(c.id)) {
        notifiedCallIdsRef.current.add(c.id);
        triggerServiceCallAlert(c);
      }
    });
  }, [calls, tables]);

  // Realtime Subscriptions
  useEffect(() => {
    const channels = db
      .channel("staff-serving-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets" }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
        if (payload.eventType === "UPDATE" && payload.new.status === "done") {
          playNotificationSound();
          toast.success("🍲 มีอาหารพร้อมเสิร์ฟ!");
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_calls" }, (payload: any) => {
        if (payload?.new?.id) {
          notifiedCallIdsRef.current.add(payload.new.id);
        }
        triggerServiceCallAlert(payload?.new);
      })
      .on("broadcast", { event: "service_call_alert" }, (payload: any) => {
        const item = payload?.payload?.new || payload?.new;
        if (item?.id) {
          if (notifiedCallIdsRef.current.has(item.id)) return;
          notifiedCallIdsRef.current.add(item.id);
        }
        triggerServiceCallAlert(item);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "service_calls" }, () => {
        qc.invalidateQueries({ queryKey: ["service-calls"] });
      })
      .subscribe();

    return () => {
      db.removeChannel(channels);
    };
  }, [qc, tables]);

  // Derived state
  const today = new Date().toISOString().slice(0, 10);

  // Modal state for viewing table bill
  const [viewBillTable, setViewBillTable] = useState<{ table: RestaurantTable; callId?: string } | null>(null);

  // Active uncompleted orders (all unpaid tables)
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.status !== "completed"),
    [orders]
  );
  const occupiedTables = tables.filter((t) => t.status === "occupied").length;
  const waitingOrders = activeOrders.filter((o) => o.status === "waiting").length;
  const inKitchenOrders = activeOrders.filter((o) => o.status === "in_kitchen").length;

  const readyTickets = tickets.filter((t) => t.status === "done" && t.done_at && t.done_at.slice(0, 10) === today);
  const billCalls = calls.filter((c) => c.message === "เรียกเช็คบิล" || c.message.includes("เช็คบิล"));
  const generalCalls = calls.filter((c) => c.message !== "เรียกเช็คบิล" && !c.message.includes("เช็คบิล"));

  // Bill calculation for modal
  const billTableOrders = useMemo(() => {
    if (!viewBillTable) return [];
    return orders.filter(
      (o) => o.table_id === viewBillTable.table.id && o.status !== "cancelled" && o.status !== "completed"
    );
  }, [viewBillTable, orders]);

  const billTableItems = useMemo(() => {
    return billTableOrders.flatMap((o) => o.order_items || []);
  }, [billTableOrders]);

  const billTableSubtotal = useMemo(() => {
    return billTableOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  }, [billTableOrders]);

  const billTableDiscount = useMemo(() => {
    return billTableOrders.reduce((s, o) => s + Number(o.discount_amount || 0), 0);
  }, [billTableOrders]);

  const billTableTotal = useMemo(() => {
    return billTableOrders.reduce((s, o) => s + Number(o.final_amount || 0), 0);
  }, [billTableOrders]);

  // Payment states for waitstaff billing modal
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  useEffect(() => {
    if (viewBillTable) {
      setPaymentMethod("");
      setPaymentNote("");
      setCashReceived("");
    }
  }, [viewBillTable?.table?.id]);

  // Staff Action: Take payment directly at the table
  const handleStaffCheckout = async (directMethod?: string) => {
    if (!viewBillTable) return;
    const method = directMethod || paymentMethod;
    if (!method) {
      toast.error("กรุณาเลือกวิธีชำระเงินก่อนดำเนินการ");
      return;
    }

    setIsCheckingOut(true);
    try {
      // 1. Mark orders as completed
      for (const o of billTableOrders) {
        await db
          .from("orders")
          .update({
            status: "completed" as OrderStatus,
            paid_at: new Date().toISOString(),
            payment_method: method,
          })
          .eq("id", o.id);

        try {
          await db.from("payments").insert({
            order_id: o.id,
            method: method === "other" ? "transfer" : method,
            amount_due: Number(o.final_amount || 0),
            amount_received: Number(o.final_amount || 0),
            change_amount: 0,
            note: paymentNote ? `[จ่ายกับพนักงานเสิร์ฟ: ${method}] ${paymentNote}` : `[จ่ายกับพนักงานเสิร์ฟ: ${method}]`,
          });
        } catch {
          // optional payment log
        }
      }

      // 2. Reset table to available
      await db.from("tables").update({ status: "available" }).eq("id", viewBillTable.table.id);

      // 3. Resolve active service calls for this table
      const relatedCalls = calls.filter((c) => c.table_id === viewBillTable.table.id);
      for (const c of relatedCalls) {
        await resolveServiceCall(c.id);
      }
      if (viewBillTable.callId) {
        await resolveServiceCall(viewBillTable.callId);
      }

      toast.success(`รับชำระเงินโต๊ะ ${viewBillTable.table.code} เรียบร้อยแล้ว (เคลียร์โต๊ะแล้ว)`);
      setViewBillTable(null);
      setPaymentMethod("");
      setPaymentNote("");
      setCashReceived("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["service-calls"] });
    } catch {
      toast.error("บันทึกการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Actions
  const handleResolveCall = async (id: string) => {
    try {
      await resolveServiceCall(id);
      qc.invalidateQueries({ queryKey: ["service-calls"] });
    } catch {
      toast.error("อัปเดตไม่สำเร็จ");
    }
  };

  const handleServeTicket = async (ticketId: string, orderId: string) => {
    try {
      await updateOrderStatus(orderId, "served");
      // Optionally also archive the ticket if we had a served status, but updating order to served is the main goal.
      // We will just optimistically rely on order status. 
      // To hide it from "ready", we should perhaps mark the ticket as delivered, but our ticket status ends at "done".
      // We can just trust order status. If order is served, we don't show its tickets.
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("ยืนยันการเสิร์ฟแล้ว");
    } catch {
      toast.error("อัปเดตไม่สำเร็จ");
    }
  };

  const handleSendToKitchen = async (orderId: string) => {
    try {
      await dispatchToKitchen({ orderId });
      toast.success("ส่งเข้าครัวแล้ว");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    } catch {
      toast.error("ส่งครัวไม่สำเร็จ");
    }
  };

  const handleSetOrderStatus = async (orderId: string, status: OrderStatus, message: string) => {
    try {
      await updateOrderStatus(orderId, status);
      toast.success(message);
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch {
      toast.error("อัปเดตสถานะไม่สำเร็จ");
    }
  };

  // Group ready items by table for display
  // We only show ready tickets if their parent order is NOT served/completed.
  const displayReadyTickets = readyTickets.filter(t => {
    const order = orders.find(o => o.id === t.order_id);
    return order && ["waiting", "in_kitchen"].includes(order.status);
  });

  return (
    <ConsoleLayout
      title="พนักงานเสิร์ฟ (Service Queue)"
      actions={
        <div className="flex items-center gap-2">
          {isTelegramActive ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 text-xs font-bold border border-sky-500/20">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              Telegram: เปิดแจ้งเตือน
            </span>
          ) : (
            <Link
              to="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
              title="ตั้งค่าแจ้งเตือน Telegram ที่เมนูแอดมิน"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Telegram: ยังไม่ตั้งค่า
            </Link>
          )}
          <button
            onClick={() => { refetchOrders(); refetchTickets(); refetchCalls(); }}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:border-primary/40 cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4", fetchingOrders && "animate-spin")} /> รีเฟรช
          </button>
        </div>
      }
    >
      <div className="grid gap-6">
        {/* SECTION 1: STATS BAR */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          <StatCard label="โต๊ะที่มีลูกค้า" value={occupiedTables} icon={Utensils} tone="muted" />
          <StatCard label="รอส่งครัว" value={waitingOrders} icon={Clock} tone="warning" />
          <StatCard label="กำลังปรุง" value={inKitchenOrders} icon={ChefHat} tone="info" />
          <StatCard label="พร้อมเสิร์ฟ" value={displayReadyTickets.length} icon={CheckCircle2} tone="success" />
          <StatCard
            label="เรียกเช็คบิล"
            value={billCalls.length}
            icon={ReceiptText}
            tone={billCalls.length > 0 ? "urgent" : "muted"}
          />
        </section>

        {/* BILL ALERT BANNER (If any table calls for bill) */}
        {billCalls.length > 0 && (
          <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm animate-bounce">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-emerald-950 dark:text-emerald-100 text-base">
                  ⚡ ลูกค้าเรียกเช็คบิล ({billCalls.length} โต๊ะ)
                </h3>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300">
                  {billCalls
                    .map((c) => {
                      const t = tables.find((tb) => tb.id === c.table_id);
                      return `โต๊ะ ${t?.code ?? "-"}`;
                    })
                    .join(", ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {billCalls.map((c) => {
                const t = tables.find((tb) => tb.id === c.table_id);
                if (!t) return null;
                return (
                  <button
                    key={c.id}
                    onClick={() => setViewBillTable({ table: t, callId: c.id })}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <ReceiptText className="h-3.5 w-3.5" />
                    <span>ดูบิล โต๊ะ {t.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* GENERAL CALL ALERT BANNER (If any table calls for staff) */}
        {generalCalls.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm animate-bounce">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-amber-950 dark:text-amber-100 text-base">
                  🔔 ลูกค้าเรียกพนักงาน ({generalCalls.length} โต๊ะ)
                </h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300">
                  {generalCalls
                    .map((c) => {
                      const t = tables.find((tb) => tb.id === c.table_id);
                      return `โต๊ะ ${t?.code ?? "-"}: "${c.message}"`;
                    })
                    .join(" | ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {generalCalls.map((c) => {
                const t = tables.find((tb) => tb.id === c.table_id);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleResolveCall(c.id)}
                    className="rounded-xl bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>รับทราบ โต๊ะ {t?.code ?? "-"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)] items-start">
          <div className="space-y-6">
            {/* SECTION 3: READY TO SERVE */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> อาหารพร้อมเสิร์ฟ
              </h2>
              {displayReadyTickets.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {displayReadyTickets.map(t => {
                    const order = orders.find(o => o.id === t.order_id);
                    const table = tables.find(tb => tb.id === order?.table_id);
                    return (
                      <div key={t.id} className={cn(bento, "p-4 border-success/40 bg-success/5 space-y-3")}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg">{order?.order_type === "takeaway" ? "กลับบ้าน" : `โต๊ะ ${table?.code ?? "-"}`}</h3>
                            <p className="text-xs text-muted-foreground">{order?.order_number}</p>
                          </div>
                          <ElapsedBadge timeStr={t.done_at!} label="ปรุงเสร็จ" />
                        </div>
                        <ul className="text-sm space-y-1">
                          {order?.order_items?.map(it => (
                            <li key={it.id} className="flex gap-2">
                              <span className="truncate flex-1">• {it.menu_name}</span>
                              <span className="font-semibold">x{it.quantity}</span>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => handleServeTicket(t.id, t.order_id)}
                          className="w-full rounded-xl bg-success px-4 py-2 text-sm font-bold text-success-foreground hover:bg-success/90"
                        >
                          ยืนยันว่าเสิร์ฟแล้ว
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={cn(bento, "p-8 text-center text-muted-foreground")}>
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ไม่มีอาหารรอเสิร์ฟ</p>
                </div>
              )}
            </section>

            {/* SECTION 4: ACTIVE ORDERS */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" /> ออเดอร์ที่กำลังดูแล
              </h2>
              {activeOrders.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeOrders.map((o) => {
                    const table = tables.find((t) => t.id === o.table_id);
                    const isWaiting = o.status === "waiting";
                    const isOrderDrinksOnly =
                      (o.order_items || []).length > 0 &&
                      (o.order_items || []).every((it) => {
                        const m = menu.find((item) => item.id === it.menu_id || item.name === it.menu_name);
                        return isDrinkMenuItem(m || { name: it.menu_name, category_id: null }, categories);
                      });

                    return (
                      <div
                        key={o.id}
                        className={cn(
                          bento,
                          "p-4 flex flex-col gap-3",
                          o.status === "served" && "opacity-75"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold">
                              {o.order_type === "takeaway" ? "กลับบ้าน" : `โต๊ะ ${table?.code ?? "-"}`}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{o.order_number}</p>
                          </div>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                              isWaiting
                                ? "bg-warning/15 text-warning"
                                : isOrderDrinksOnly && o.status === "in_kitchen"
                                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold"
                                : o.status === "in_kitchen"
                                ? "bg-info/15 text-info"
                                : "bg-success/15 text-success"
                            )}
                          >
                            {isWaiting
                              ? "รอส่งครัว"
                              : isOrderDrinksOnly && o.status === "in_kitchen"
                              ? "🥤 เครื่องดื่มล้วน"
                              : o.status === "in_kitchen"
                              ? "กำลังปรุง"
                              : "เสิร์ฟแล้ว"}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center justify-between">
                          <span>{o.order_items?.length} รายการ · {baht(o.final_amount)}</span>
                          {table && (
                            <button
                              type="button"
                              onClick={() => setViewBillTable({ table })}
                              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> ดูบิลโต๊ะนี้
                            </button>
                          )}
                        </div>
                        {o.order_items && o.order_items.length > 0 && (
                          <ul className="space-y-1 text-xs bg-muted/40 p-2.5 rounded-xl border border-border/40 max-h-36 overflow-y-auto">
                            {o.order_items.map((it) => {
                              const m = menu.find((item) => item.id === it.menu_id || item.name === it.menu_name);
                              const drink = isDrinkMenuItem(m || { name: it.menu_name, category_id: null }, categories);
                              return (
                                <li
                                  key={it.id}
                                  className="flex justify-between items-center text-foreground gap-1.5"
                                >
                                  <span className="truncate flex-1 flex items-center gap-1">
                                    <span>• {it.menu_name}</span>
                                    {drink && (
                                      <span className="rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-1 py-0.2 text-[10px] font-bold shrink-0">
                                        🥤 เสิร์ฟได้เลย
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-semibold ml-2 text-primary shrink-0">
                                    x{it.quantity}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-border/50">
                          {isWaiting ? (
                            <button
                              onClick={() => handleSendToKitchen(o.id)}
                              className="col-span-2 rounded-xl bg-primary/10 text-primary py-2 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <Printer className="inline h-3.5 w-3.5 mr-1" /> ส่งครัว
                            </button>
                          ) : isOrderDrinksOnly && o.status === "in_kitchen" ? (
                            <button
                              onClick={() => handleSetOrderStatus(o.id, "served", "เสิร์ฟเครื่องดื่มเรียบร้อยแล้ว")}
                              className="col-span-2 rounded-xl bg-sky-600 text-white py-2 text-xs font-bold hover:bg-sky-700 transition-colors shadow-xs"
                            >
                              🥤 ยืนยันว่าเสิร์ฟเครื่องดื่มแล้ว
                            </button>
                          ) : o.status === "in_kitchen" ? (
                            <div className="col-span-2 flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground py-2 px-3 bg-muted/30 rounded-xl flex-1 text-center">
                                กำลังปรุงในครัว...
                              </span>
                              <button
                                onClick={() => handleSetOrderStatus(o.id, "served", "อัปเดตเป็นเสิร์ฟแล้วเรียบร้อย")}
                                className="rounded-xl border border-success/30 bg-success/10 text-success hover:bg-success hover:text-success-foreground px-3 py-2 text-xs font-bold transition-colors"
                              >
                                เสิร์ฟแล้ว
                              </button>
                            </div>
                          ) : (
                            <div className="col-span-2 text-center text-xs text-success py-2 bg-success/10 rounded-xl font-bold">
                              ✓ เสิร์ฟแล้วเรียบร้อย
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={cn(bento, "p-8 text-center text-muted-foreground")}>
                  <p className="text-sm">ไม่มีออเดอร์ในขณะนี้</p>
                </div>
              )}
            </section>
          </div>

          {/* SIDEBAR: SEPARATED CALLS & BILL NOTIFICATIONS */}
          <div className="space-y-6 sticky top-24">
            {/* 1. SEPARATE NOTIFICATION: BILL REQUESTS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <ReceiptText className="h-5 w-5 text-emerald-500" />
                  โต๊ะเรียกเช็คบิล
                </h2>
                {billCalls.length > 0 ? (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                    {billCalls.length} โต๊ะ
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">ไม่มี</span>
                )}
              </div>

              {billCalls.length > 0 ? (
                <div className="space-y-3">
                  {billCalls.map((c) => {
                    const table = tables.find((t) => t.id === c.table_id);
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          bento,
                          "p-4 border-emerald-500/40 shadow-lg ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col gap-3 animate-in slide-in-from-right-4"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                            <span className="font-black text-xl text-emerald-800 dark:text-emerald-200">
                              โต๊ะ {table?.code ?? "-"}
                            </span>
                          </div>
                          <ElapsedBadge timeStr={c.created_at} label="เรียก" urgentMinutes={2} />
                        </div>
                        {(() => {
                          const tOrders = orders.filter(
                            (o) => o.table_id === c.table_id && o.status !== "cancelled" && o.status !== "completed"
                          );
                          const tTotal = tOrders.reduce((s, o) => s + Number(o.final_amount || 0), 0);
                          const tItemsCount = tOrders.reduce((s, o) => s + (o.order_items?.length || 0), 0);
                          return (
                            <div className="flex justify-between items-center rounded-xl bg-card border border-emerald-500/20 px-3 py-2 text-xs font-semibold">
                              <span className="text-emerald-800 dark:text-emerald-200">
                                {tOrders.length} ออเดอร์ ({tItemsCount} รายการ)
                              </span>
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                {baht(tTotal)}
                              </span>
                            </div>
                          );
                        })()}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              if (table) setViewBillTable({ table, callId: c.id });
                            }}
                            className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" /> ดูบิล / รายการ
                          </button>
                          <button
                            onClick={() => handleResolveCall(c.id)}
                            className="rounded-xl border border-emerald-600/30 bg-card px-3 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-muted active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckSquare className="h-3.5 w-3.5 text-emerald-600" /> เคลียร์แจ้งเตือน
                          </button>
                        </div>
                        {isTelegramActive && (
                          <button
                            onClick={() => handleResendTelegram(c.id, c.table_id, c.message)}
                            disabled={resendingCallId === c.id}
                            className="w-full rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 py-1.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {resendingCallId === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            <span>แจ้งเตือน Telegram ซ้ำ</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={cn(bento, "p-4 text-center text-muted-foreground border-dashed")}>
                  <ReceiptText className="h-6 w-6 mx-auto mb-1.5 opacity-30 text-emerald-500" />
                  <p className="text-xs">ไม่มีโต๊ะเรียกเช็คบิลในขณะนี้</p>
                </div>
              )}
            </div>

            {/* 2. SEPARATE NOTIFICATION: GENERAL SERVICE CALLS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-primary" />
                  เรียกพนักงานทั่วไป
                </h2>
                {generalCalls.length > 0 && (
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {generalCalls.length} งาน
                  </span>
                )}
              </div>

              {generalCalls.length > 0 ? (
                <div className="space-y-3">
                  {generalCalls.map((c) => {
                    const table = tables.find((t) => t.id === c.table_id);
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          bento,
                          "p-4 border-primary/30 shadow-md ring-1 ring-primary/20 bg-card flex flex-col gap-3 animate-in slide-in-from-right-4"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-primary animate-pulse" />
                            <span className="font-bold text-lg">โต๊ะ {table?.code ?? "-"}</span>
                          </div>
                          <ElapsedBadge timeStr={c.created_at} label="เรียก" urgentMinutes={3} />
                        </div>
                        <p className="text-sm bg-muted/40 p-3 rounded-xl border border-border/50">{c.message}</p>
                        <div className={cn("grid gap-2", isTelegramActive ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                          <button
                            onClick={() => handleResolveCall(c.id)}
                            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <CheckSquare className="h-4 w-4" /> รับทราบ / บริการแล้ว
                          </button>
                          {isTelegramActive && (
                            <button
                              onClick={() => handleResendTelegram(c.id, c.table_id, c.message)}
                              disabled={resendingCallId === c.id}
                              className="rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {resendingCallId === c.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              <span>ส่งเตือน Telegram</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={cn(bento, "p-6 text-center text-muted-foreground")}>
                  <BellRing className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
                  <p className="text-xs">
                    ไม่มีงานเรียกพนักงาน
                    <br />
                    <span className="text-[11px] opacity-70">ทุกโต๊ะได้รับการดูแลแล้ว</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bill & Items Modal for Waitstaff ──────────────────────── */}
      {viewBillTable && (
        <Modal
          title={
            <div>
              <p className="text-[11px] font-bold tracking-widest text-primary uppercase">
                BILLING
              </p>
              <p className="text-xl font-black">โต๊ะ: {viewBillTable.table.code}</p>
            </div>
          }
          onClose={() => setViewBillTable(null)}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Table & Order Info Header */}
            <div className="rounded-xl bg-muted/40 p-3 text-xs flex justify-between items-center text-muted-foreground border border-border/40">
              <span>สถานะ: <strong className="text-foreground font-semibold">{viewBillTable.table.status === "occupied" ? "มีลูกค้า" : "ว่าง"}</strong></span>
              <span>จำนวนคำสั่งซื้อ: <strong className="text-foreground font-semibold">{billTableOrders.length} ครั้ง</strong></span>
            </div>

            {/* Item List */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>รายการอาหาร & เครื่องดื่ม</span>
                <span>{billTableItems.length} รายการ</span>
              </h4>

              {billTableItems.length > 0 ? (
                <div className="space-y-2.5 divide-y divide-border/40">
                  {billTableItems.map((it, idx) => {
                    const m = menu.find((item) => item.id === it.menu_id || item.name === it.menu_name);
                    const drink = isDrinkMenuItem(m || { name: it.menu_name, category_id: null }, categories);
                    return (
                      <div
                        key={`${it.id}-${idx}`}
                        className="flex justify-between items-start gap-3 pt-2.5 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                            <span>{it.menu_name} × {it.quantity}</span>
                            {drink ? (
                              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                                🥤 เครื่องดื่ม
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                🍳 อาหาร
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {baht(it.unit_price)} / รายการ
                          </p>
                        </div>
                        <span className="text-sm font-bold text-primary shrink-0">
                          {baht(it.subtotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground space-y-1">
                  <Receipt className="h-8 w-8 mx-auto opacity-30 text-emerald-500" />
                  <p className="font-semibold text-sm">ยังไม่มีรายการอาหารค้างชำระในระบบสำหรับโต๊ะนี้</p>
                  <p className="text-[11px] opacity-70">หากลูกค้าสั่งผ่านพนักงานหรือต้องการเพิ่มรายการ สามารถไปที่หน้า POS</p>
                </div>
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2 border-y border-border/60 py-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>ยอดก่อนส่วนลด</span>
                <span className="font-medium text-foreground">{baht(billTableSubtotal)}</span>
              </div>
              {billTableDiscount > 0 && (
                <div className="flex justify-between text-success">
                  <span>ส่วนลด</span>
                  <span className="font-medium">-{baht(billTableDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 text-base font-black">
                <span>ยอดรวมทั้งหมด</span>
                <span className="text-2xl font-black text-primary">{baht(billTableTotal)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">วิธีชำระเงิน</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">เลือกวิธีชำระ</option>
                <option value="cash">เงินสด</option>
                <option value="transfer">โอนเงิน</option>
                <option value="card">บัตร</option>
                <option value="other">อื่น ๆ</option>
              </select>
            </div>

            {/* Dynamic PromptPay QR Section when "โอนเงิน" */}
            {paymentMethod === "transfer" && (
              <PromptPayBillingSection
                amount={billTableTotal}
                table={viewBillTable.table.code}
                isProcessingCheckout={isCheckingOut}
                onPaymentSuccess={async (mode) => {
                  if (mode === "auto") {
                    toast.success("ตรวจพบการชำระเงินผ่าน PromptPay เรียบร้อยแล้ว!");
                  }
                  await handleStaffCheckout("transfer");
                }}
              />
            )}

            {/* Cash Input & Change when "เงินสด" */}
            {paymentMethod === "cash" && (
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                  <span>รับเงินสดจากลูกค้า</span>
                  <span className="text-foreground font-semibold">ยอดต้องชำระ: {baht(billTableTotal)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">฿</span>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border bg-background pl-8 pr-3 py-2 text-base font-bold outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(billTableTotal))}
                    className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-bold hover:bg-muted transition-colors"
                  >
                    พอดี ({baht(billTableTotal)})
                  </button>
                  {[100, 500, 1000].map((note) => {
                    if (note >= billTableTotal) {
                      return (
                        <button
                          key={note}
                          type="button"
                          onClick={() => setCashReceived(String(note))}
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-colors"
                        >
                          ฿{note}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
                {Number(cashReceived) >= billTableTotal && (
                  <div className="flex justify-between items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span>เงินทอนลูกค้า</span>
                    <span className="text-sm font-black">{baht(Number(cashReceived) - billTableTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reference Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">เลขอ้างอิง (ถ้ามี)</label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="ระบุเลขอ้างอิงสลิป / รหัสธุรกรรม..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isCheckingOut || !paymentMethod || (paymentMethod === "cash" && Number(cashReceived) > 0 && Number(cashReceived) < billTableTotal)}
                onClick={() => handleStaffCheckout()}
                className="w-full rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-glow hover:bg-primary/95 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCheckingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึกการชำระเงิน...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CheckSquare className="h-5 w-5" /> รับชำระเงินกับพนักงานเสิร์ฟ ({baht(billTableTotal)})
                  </span>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="rounded-xl border border-border bg-card py-2.5 text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-4 w-4" /> พิมพ์บิล / Slip
                </button>

                {viewBillTable.callId ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (viewBillTable.callId) {
                        await handleResolveCall(viewBillTable.callId);
                        toast.success(`เคลียร์สถานะเรียกเช็คบิล โต๊ะ ${viewBillTable.table.code} เรียบร้อยแล้ว`);
                      }
                      setViewBillTable(null);
                    }}
                    className="rounded-xl border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 py-2.5 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckSquare className="h-4 w-4" /> เคลียร์แจ้งเตือนเท่านั้น
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setViewBillTable(null)}
                    className="rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                  >
                    ปิดหน้าต่าง
                  </button>
                )}
              </div>

              {viewBillTable.callId && (
                <button
                  type="button"
                  onClick={() => setViewBillTable(null)}
                  className="w-full rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </ConsoleLayout>
  );
}

/* ── UI Helpers ────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, tone }: { label: string, value: number, icon: any, tone: "muted" | "warning" | "info" | "success" | "urgent" }) {
  const tones = {
    muted: "text-foreground bg-muted",
    warning: "text-warning bg-warning/15",
    info: "text-info bg-info/15",
    success: "text-success bg-success/15",
    urgent: "text-emerald-700 bg-emerald-500/20 ring-1 ring-emerald-500/40",
  };
  return (
    <div className={cn(bento, "p-4 flex flex-col gap-2")}>
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <div className="flex justify-between items-end">
        <span className="text-2xl font-black">{value}</span>
        <div className={cn("p-1.5 rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ElapsedBadge({ timeStr, label, urgentMinutes = 5 }: { timeStr: string, label: string, urgentMinutes?: number }) {
  const mins = Math.floor((Date.now() - new Date(timeStr).getTime()) / 60_000);
  const isUrgent = mins >= urgentMinutes;
  return (
    <span className={cn(
      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
      isUrgent ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border/50"
    )}>
      {label} {mins} นาทีที่แล้ว
    </span>
  );
}
