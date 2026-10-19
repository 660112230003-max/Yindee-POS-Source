import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  ChefHat,
  BellRing,
  ReceiptText,
  Utensils,
  CheckCircle2,
  Clock,
  Flame,
  Printer,
  RefreshCw,
  ShoppingBag,
  ShieldCheck,
  AlertCircle,
  CheckSquare,
  Eye,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ConsoleLayout, bento } from "@/components/console-layout";
import { Modal } from "@/components/modal";
import {
  baht,
  db,
  fetchOrders,
  fetchTables,
  fetchKitchenTickets,
  fetchServiceCalls,
  fetchCategories,
  fetchMenu,
  isDrinkMenuItem,
  updateOrderStatus,
  setKitchenTicketStatus,
  resolveServiceCall,
  type Order,
  type RestaurantTable,
  type KitchenTicket,
  type KitchenTicketStatus,
  type OrderStatus,
} from "@/lib/restaurant";
import { playNotificationSound } from "@/lib/notification-sound";
import { StaffGuard, lockStaffSession } from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/all-in-one")({
  head: () => ({
    meta: [
      { title: "รวมงานหน้าร้าน (All-in-One) · Restaurant OS" },
      {
        name: "description",
        content: "ระบบรวมงานหน้าร้าน จอครัว พนักงานเสิร์ฟ และแคชเชียร์ในหน้าเดียวสำหรับแท็บเล็ต",
      },
    ],
  }),
  component: AllInOnePage,
});

function AllInOnePage() {
  return (
    <StaffGuard pageTitle="รวมงานหน้าร้าน">
      <AllInOneContent />
    </StaffGuard>
  );
}

type TabMode = "unified" | "kitchen" | "staff" | "cashier";

function AllInOneContent() {
  const qc = useQueryClient();
  const [tabMode, setTabMode] = useState<TabMode>("unified");

  // Queries
  const { data: tables = [], refetch: refetchTables } = useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
  });
  const { data: orders = [], refetch: refetchOrders, isFetching } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });
  const { data: tickets = [], refetch: refetchTickets } = useQuery({
    queryKey: ["kitchen-tickets"],
    queryFn: fetchKitchenTickets,
  });
  const { data: calls = [], refetch: refetchCalls } = useQuery({
    queryKey: ["service-calls"],
    queryFn: fetchServiceCalls,
    refetchInterval: 3000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { data: menu = [] } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu,
  });

  // Billing Modal State
  const [billingTable, setBillingTable] = useState<RestaurantTable | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Track notified call IDs to prevent duplicate toasts
  const notifiedCallIdsRef = useRef<Set<string>>(new Set());
  const initialLoadedRef = useRef(false);

  const triggerCallAlert = (callItem: any) => {
    qc.invalidateQueries({ queryKey: ["service-calls"] });
    playNotificationSound();
    const msg = callItem?.message ?? "";
    const targetTable = tables.find((t) => t.id === callItem?.table_id || t.code === callItem?.table_code);
    const name = targetTable ? `โต๊ะ ${targetTable.code}` : (callItem?.table_code ? `โต๊ะ ${callItem.table_code}` : "มีลูกค้า");
    if (msg === "เรียกเช็คบิล" || msg.includes("เช็คบิล")) {
      toast.warning(`🧾 ${name} เรียกเช็คบิล!`, {
        description: "ลูกค้ากดเรียกเช็คบิล กรุณาตรวจบิลและคิดเงิน",
        duration: 9000,
      });
    } else {
      toast.info(`🔔 ${name} เรียกพนักงาน`, {
        description: msg || "ลูกค้ากดเรียกพนักงาน",
        duration: 8000,
      });
    }
  };

  // Detect newly fetched calls via polling as a guaranteed fallback
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      const now = Date.now();
      calls.forEach((c) => {
        const ageMs = c.created_at ? now - new Date(c.created_at).getTime() : 999999;
        if (!c.resolved && ageMs < 60000) {
          notifiedCallIdsRef.current.add(c.id);
          triggerCallAlert(c);
        } else {
          notifiedCallIdsRef.current.add(c.id);
        }
      });
      return;
    }

    calls.forEach((c) => {
      if (!c.resolved && !notifiedCallIdsRef.current.has(c.id)) {
        notifiedCallIdsRef.current.add(c.id);
        triggerCallAlert(c);
      }
    });
  }, [calls, tables]);

  // Real-time Subscriptions
  useEffect(() => {
    const channel = db
      .channel("staff-serving-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        qc.invalidateQueries({ queryKey: ["tables"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets" }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
        if (payload?.eventType === "UPDATE" && payload?.new?.status === "done") {
          playNotificationSound();
          toast.success("🍲 มีอาหารปรุงเสร็จแล้วพร้อมเสิร์ฟ!");
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_calls" }, (payload: any) => {
        if (payload?.new?.id) {
          if (notifiedCallIdsRef.current.has(payload.new.id)) return;
          notifiedCallIdsRef.current.add(payload.new.id);
        }
        triggerCallAlert(payload?.new);
      })
      .on("broadcast", { event: "service_call_alert" }, (payload: any) => {
        const item = payload?.payload?.new || payload?.new;
        if (item?.id) {
          if (notifiedCallIdsRef.current.has(item.id)) return;
          notifiedCallIdsRef.current.add(item.id);
        }
        triggerCallAlert(item);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "service_calls" }, () => {
        qc.invalidateQueries({ queryKey: ["service-calls"] });
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [qc, tables]);

  // Derived metrics
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.status !== "completed"),
    [orders]
  );
  const occupiedCount = useMemo(
    () => tables.filter((t) => t.status === "occupied").length,
    [tables]
  );
  const billCalls = useMemo(
    () => calls.filter((c) => c.message === "เรียกเช็คบิล" || c.message.includes("เช็คบิล")),
    [calls]
  );
  const generalCalls = useMemo(
    () => calls.filter((c) => c.message !== "เรียกเช็คบิล" && !c.message.includes("เช็คบิล")),
    [calls]
  );

  // Kitchen tickets breakdown
  const newTickets = tickets.filter((t) => t.status === "sent" || t.status === "received");
  const cookingTickets = tickets.filter((t) => t.status === "cooking");
  const readyTickets = tickets.filter((t) => {
    if (t.status !== "done") return false;
    const parentOrder = orders.find((o) => o.id === t.order_id);
    return parentOrder && ["waiting", "in_kitchen"].includes(parentOrder.status);
  });

  // Selected table billing data
  const selectedTableOrders = useMemo(() => {
    if (!billingTable) return [];
    return orders.filter(
      (o) => o.table_id === billingTable.id && o.status !== "cancelled" && o.status !== "completed"
    );
  }, [billingTable, orders]);

  const selectedTableItems = useMemo(() => {
    return selectedTableOrders.flatMap((o) => o.order_items || []);
  }, [selectedTableOrders]);

  const selectedTableSubtotal = useMemo(() => {
    return selectedTableOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  }, [selectedTableOrders]);

  const selectedTableDiscount = useMemo(() => {
    return selectedTableOrders.reduce((s, o) => s + Number(o.discount_amount || 0), 0);
  }, [selectedTableOrders]);

  const selectedTableTotal = useMemo(() => {
    return selectedTableOrders.reduce((s, o) => s + Number(o.final_amount || 0), 0);
  }, [selectedTableOrders]);

  // Kitchen Action
  const handleAdvanceKitchen = async (ticket: KitchenTicket, nextStatus: KitchenTicketStatus, msg: string) => {
    try {
      await setKitchenTicketStatus(ticket.id, nextStatus);
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    } catch {
      toast.error("อัปเดตสถานะครัวไม่สำเร็จ");
    }
  };

  // Staff Action: serve ticket
  const handleServeTicket = async (ticketId: string, orderId: string) => {
    try {
      await updateOrderStatus(orderId, "served");
      toast.success("เสิร์ฟอาหารเรียบร้อยแล้ว");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    } catch {
      toast.error("อัปเดตไม่สำเร็จ");
    }
  };

  // Resolve service call
  const handleResolveCall = async (callId: string) => {
    try {
      await resolveServiceCall(callId);
      toast.success("เคลียร์งานบริการเรียบร้อยแล้ว");
      qc.invalidateQueries({ queryKey: ["service-calls"] });
    } catch {
      toast.error("อัปเดตไม่สำเร็จ");
    }
  };

  // Checkout & Reset Table
  const handleCheckoutAndReset = async () => {
    if (!billingTable) return;
    if (!paymentMethod) {
      toast.error("กรุณาเลือกวิธีชำระเงินก่อนดำเนินการ");
      return;
    }

    setIsCheckingOut(true);
    try {
      // 1. Mark orders as completed
      for (const o of selectedTableOrders) {
        await db
          .from("orders")
          .update({
            status: "completed" as OrderStatus,
            paid_at: new Date().toISOString(),
            payment_method: paymentMethod,
          })
          .eq("id", o.id);

        try {
          await db.from("payments").insert({
            order_id: o.id,
            method: paymentMethod === "other" ? "transfer" : paymentMethod,
            amount_due: Number(o.final_amount || 0),
            amount_received: Number(o.final_amount || 0),
            change_amount: 0,
            note: paymentNote ? `[${paymentMethod}] ${paymentNote}` : paymentMethod,
          });
        } catch {
          // optional payment log
        }
      }

      // 2. Reset table to available
      await db.from("tables").update({ status: "available" }).eq("id", billingTable.id);

      // 3. Resolve calls
      const relatedCalls = calls.filter((c) => c.table_id === billingTable.id);
      for (const c of relatedCalls) await resolveServiceCall(c.id);

      toast.success(`รับชำระเงินและรีเซ็ตโต๊ะ ${billingTable.code} สำเร็จ`);
      setBillingTable(null);
      setPaymentMethod("");
      setPaymentNote("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["service-calls"] });
    } catch {
      toast.error("บันทึกการชำระเงินไม่สำเร็จ");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <ConsoleLayout title="รวมงานหน้าร้าน (All-in-One Tablet Ops)">
      <div className="space-y-5">
        {/* Top Controls: Tablet Mode Switcher + Action Shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-black uppercase tracking-wider">
                TABLET DASHBOARD
              </span>
              <span className="text-xs text-muted-foreground">จอรวม ครัว + เสิร์ฟ + แคชเชียร์</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">รวมงานหน้าร้าน</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex rounded-xl border border-border bg-card p-1 text-xs font-bold shadow-xs">
              <button
                onClick={() => setTabMode("unified")}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
                  tabMode === "unified"
                    ? "bg-primary text-primary-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>รวม 3 ส่วน</span>
              </button>
              <button
                onClick={() => setTabMode("kitchen")}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
                  tabMode === "kitchen"
                    ? "bg-amber-600 text-white shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ChefHat className="h-3.5 w-3.5" />
                <span>ครัว ({cookingTickets.length + newTickets.length})</span>
              </button>
              <button
                onClick={() => setTabMode("staff")}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
                  tabMode === "staff"
                    ? "bg-sky-600 text-white shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BellRing className="h-3.5 w-3.5" />
                <span>เสิร์ฟ ({readyTickets.length + billCalls.length})</span>
              </button>
              <button
                onClick={() => setTabMode("cashier")}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
                  tabMode === "cashier"
                    ? "bg-emerald-600 text-white shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ReceiptText className="h-3.5 w-3.5" />
                <span>แคชเชียร์ ({occupiedCount})</span>
              </button>
            </div>

            <Link
              to="/pos"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>สั่งออเดอร์ (POS)</span>
            </Link>

            <button
              onClick={() => {
                refetchOrders();
                refetchTables();
                refetchTickets();
                refetchCalls();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:border-primary/40 transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* 4 Summary Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className={cn(bento, "p-4 flex flex-col justify-between")}>
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Utensils className="h-3.5 w-3.5 text-muted-foreground" /> โต๊ะที่มีลูกค้า
            </span>
            <span className="text-2xl sm:text-3xl font-black mt-2">{occupiedCount} โต๊ะ</span>
          </div>
          <div className={cn(bento, "p-4 flex flex-col justify-between border-amber-500/20")}>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" /> กำลังปรุงในครัว
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
              {cookingTickets.length + newTickets.length} ออเดอร์
            </span>
          </div>
          <div className={cn(bento, "p-4 flex flex-col justify-between border-sky-500/20")}>
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> อาหารพร้อมเสิร์ฟ
            </span>
            <span className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 mt-2">
              {readyTickets.length} รายการ
            </span>
          </div>
          <div
            className={cn(
              bento,
              "p-4 flex flex-col justify-between",
              billCalls.length > 0
                ? "border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/20 animate-pulse"
                : "border-border"
            )}
          >
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <ReceiptText className="h-3.5 w-3.5" /> เรียกเช็คบิล
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-2">
              {billCalls.length} โต๊ะ
            </span>
          </div>
        </section>

        {/* Urgent Bill Calls Alert Banner */}
        {billCalls.length > 0 && (
          <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/15 p-4 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm animate-bounce">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-emerald-950 dark:text-emerald-100 text-base">
                  ⚡ มีโต๊ะเรียกเช็คบิล {billCalls.length} โต๊ะ!
                </h3>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300">
                  ลูกค้าเรียกเช็คบิล กรุณาตรวจบิลและรับชำระเงิน
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
                    onClick={() => setBillingTable(t)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-black text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <ReceiptText className="h-4 w-4" />
                    <span>ตรวจบิล โต๊ะ {t.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: Unified 3-Columns or Single Focus ── */}
        <div
          className={cn(
            "grid gap-5 items-start",
            tabMode === "unified" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
          )}
        >
          {/* COLUMN 1: KITCHEN (ครัว) */}
          {(tabMode === "unified" || tabMode === "kitchen") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <ChefHat className="h-5 w-5" />
                  <span>1. งานห้องครัว ({cookingTickets.length + newTickets.length})</span>
                </h2>
                <Link
                  to="/kitchen"
                  className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
                >
                  เปิดเต็มจอ ➔
                </Link>
              </div>

              <div className="space-y-3">
                {/* Tickets In Kitchen */}
                {newTickets.concat(cookingTickets).length > 0 ? (
                  newTickets.concat(cookingTickets).map((ticket) => {
                    const order = ticket.orders;
                    const table = tables.find((tb) => tb.id === order?.table_id);
                    const isCooking = ticket.status === "cooking";
                    const isDrink = (menuId: string | null | undefined, menuName: string) => {
                      const item = menu.find((m) => (menuId && m.id === menuId) || m.name === menuName);
                      return isDrinkMenuItem(item || { name: menuName, category_id: null }, categories);
                    };
                    const kitchenFoodItems = (order?.order_items ?? []).filter(
                      (it) => !isDrink(it.menu_id, it.menu_name)
                    );

                    return (
                      <div
                        key={ticket.id}
                        className={cn(
                          bento,
                          "p-4 space-y-3 border-amber-500/30 bg-card shadow-xs",
                          isCooking && "ring-1 ring-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-base">
                              {order?.order_type === "takeaway" ? "กลับบ้าน" : `โต๊ะ ${table?.code ?? "-"}`}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {order?.order_number} · {new Date(ticket.sent_at).toLocaleTimeString("th-TH")}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-bold",
                              isCooking
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isCooking ? "กำลังทำ" : "รอคิวทำ"}
                          </span>
                        </div>

                        {/* Food items */}
                        <ul className="space-y-1 rounded-xl bg-muted/40 p-2.5 text-xs">
                          {kitchenFoodItems.map((it) => (
                            <li key={it.id} className="flex justify-between text-foreground">
                              <span className="truncate flex-1">• {it.menu_name}</span>
                              <span className="font-bold text-primary ml-2">x{it.quantity}</span>
                            </li>
                          ))}
                          {kitchenFoodItems.length === 0 && (
                            <li className="text-muted-foreground">ไม่มีรายการอาหารสำหรับครัว</li>
                          )}
                        </ul>

                        {/* Action buttons */}
                        <div className="pt-1">
                          {!isCooking ? (
                            <button
                              onClick={() => handleAdvanceKitchen(ticket, "cooking", "เริ่มทำออเดอร์แล้ว")}
                              className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 py-2 text-xs font-bold text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Flame className="h-4 w-4" /> เริ่มทำ (Cooking)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAdvanceKitchen(ticket, "done", "ปรุงเสร็จแล้ว พร้อมเสิร์ฟ!")}
                              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="h-4 w-4" /> ปรุงเสร็จแล้ว (พร้อมเสิร์ฟ)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={cn(bento, "p-8 text-center text-muted-foreground border-dashed")}>
                    <ChefHat className="h-8 w-8 mx-auto mb-2 opacity-30 text-amber-500" />
                    <p className="text-xs font-semibold">ไม่มีออเดอร์ค้างในครัว</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COLUMN 2: STAFF (พนักงานเสิร์ฟ & ดูแลลูกค้า) */}
          {(tabMode === "unified" || tabMode === "staff") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold flex items-center gap-2 text-sky-700 dark:text-sky-400">
                  <BellRing className="h-5 w-5" />
                  <span>2. งานเสิร์ฟ &amp; บริการ ({readyTickets.length + generalCalls.length})</span>
                </h2>
                <Link
                  to="/staff"
                  className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
                >
                  เปิดเต็มจอ ➔
                </Link>
              </div>

              <div className="space-y-3">
                {/* 1. Ready to Serve */}
                {readyTickets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                      อาหารพร้อมเสิร์ฟ ({readyTickets.length})
                    </p>
                    {readyTickets.map((t) => {
                      const order = orders.find((o) => o.id === t.order_id);
                      const table = tables.find((tb) => tb.id === order?.table_id);
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            bento,
                            "p-3.5 border-sky-500/40 bg-sky-50/30 dark:bg-sky-950/20 space-y-2.5 shadow-xs"
                          )}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-base">
                                {order?.order_type === "takeaway" ? "กลับบ้าน" : `โต๊ะ ${table?.code ?? "-"}`}
                              </p>
                              <p className="text-xs text-muted-foreground">{order?.order_number}</p>
                            </div>
                            <span className="rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[11px] font-bold">
                              พร้อมเสิร์ฟ!
                            </span>
                          </div>

                          <ul className="text-xs space-y-1 bg-card/80 p-2 rounded-xl">
                            {order?.order_items?.map((it) => (
                              <li key={it.id} className="flex justify-between">
                                <span className="truncate flex-1">• {it.menu_name}</span>
                                <span className="font-bold text-primary ml-2">x{it.quantity}</span>
                              </li>
                            ))}
                          </ul>

                          <button
                            onClick={() => handleServeTicket(t.id, t.order_id)}
                            className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 py-2 text-xs font-bold text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <CheckSquare className="h-4 w-4" /> ยืนยันว่าเสิร์ฟแล้ว
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Customer Service Calls */}
                {generalCalls.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">
                      ลูกค้าเรียกบริการ ({generalCalls.length})
                    </p>
                    {generalCalls.map((c) => {
                      const t = tables.find((tb) => tb.id === c.table_id);
                      return (
                        <div
                          key={c.id}
                          className={cn(bento, "p-3.5 border-primary/30 bg-card space-y-2.5 shadow-xs")}
                        >
                          <div className="flex justify-between items-start">
                            <p className="font-bold text-sm text-foreground">โต๊ะ {t?.code ?? "-"}</p>
                            <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                              เรียกบริการ
                            </span>
                          </div>
                          <p className="text-xs text-foreground bg-muted/40 p-2 rounded-lg font-medium">
                            {c.message}
                          </p>
                          <button
                            onClick={() => handleResolveCall(c.id)}
                            className="w-full rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary hover:text-white py-1.5 text-xs font-bold text-primary transition-colors"
                          >
                            เคลียร์งานบริการแล้ว
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {readyTickets.length === 0 && generalCalls.length === 0 && (
                  <div className={cn(bento, "p-8 text-center text-muted-foreground border-dashed")}>
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-sky-500" />
                    <p className="text-xs font-semibold">ไม่มีอาหารรอเสิร์ฟ หรือลูกค้าเรียกในขณะนี้</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COLUMN 3: CASHIER (แคชเชียร์ & ตรวจบิล) */}
          {(tabMode === "unified" || tabMode === "cashier") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <ReceiptText className="h-5 w-5" />
                  <span>
                    3. แคชเชียร์ &amp; โต๊ะ ({occupiedCount}
                    {activeOrders.filter((o) => o.order_type === "takeaway" || !o.table_id).length > 0
                      ? ` + ${activeOrders.filter((o) => o.order_type === "takeaway" || !o.table_id).length} กลับบ้าน`
                      : ""}
                    )
                  </span>
                </h2>
                <Link
                  to="/order-status"
                  className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
                >
                  เปิดเต็มจอ ➔
                </Link>
              </div>

              <div className="space-y-3">
                {/* 1. Dine-in Occupied Tables */}
                {tables
                  .filter((t) => t.status === "occupied")
                  .map((table) => {
                    const tableOrders = activeOrders.filter((o) => o.table_id === table.id);
                    const totalAmount = tableOrders.reduce((s, o) => s + Number(o.final_amount || 0), 0);
                    const totalItems = tableOrders.reduce(
                      (s, o) => s + (o.order_items?.length || 0),
                      0
                    );
                    const isCallingBill = billCalls.some((c) => c.table_id === table.id);

                    return (
                      <div
                        key={table.id}
                        className={cn(
                          bento,
                          "p-4 space-y-3 shadow-xs transition-all",
                          isCallingBill
                            ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-lg text-foreground">โต๊ะ {table.code}</p>
                            <p className="text-xs text-muted-foreground">
                              {tableOrders.length} ออเดอร์ ({totalItems} รายการ)
                            </p>
                          </div>
                          {isCallingBill ? (
                            <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-xs font-bold animate-bounce">
                              เรียกเช็คบิล!
                            </span>
                          ) : (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              มีลูกค้า
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-baseline pt-1 border-t border-border/50 text-sm font-bold">
                          <span className="text-muted-foreground">ยอดรวม</span>
                          <span className="text-base font-black text-primary">{baht(totalAmount)}</span>
                        </div>

                        <button
                          onClick={() => setBillingTable(table)}
                          className={cn(
                            "w-full rounded-xl py-2 text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5",
                            isCallingBill
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                              : "border border-border bg-card hover:bg-muted text-foreground"
                          )}
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                          <span>ตรวจบิล &amp; คิดเงิน</span>
                        </button>
                      </div>
                    );
                  })}

                {/* 2. Active Takeaway Orders */}
                {activeOrders
                  .filter((o) => o.order_type === "takeaway" || !o.table_id)
                  .map((o) => {
                    const totalItems = o.order_items?.reduce((s, it) => s + it.quantity, 0) || 0;
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          bento,
                          "p-4 space-y-3 shadow-xs transition-all border-primary/30 bg-primary/5"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-base text-foreground flex items-center gap-1.5">
                              <ShoppingBag className="h-4 w-4 text-primary" />
                              <span>กลับบ้าน ({o.customer_name || o.order_number.slice(-6)})</span>
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              #{o.order_number} · {totalItems} รายการ
                            </p>
                          </div>
                          <span className="rounded-full bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 text-xs font-bold">
                            สั่งกลับบ้าน
                          </span>
                        </div>

                        <div className="flex justify-between items-baseline pt-1 border-t border-border/50 text-sm font-bold">
                          <span className="text-muted-foreground">ยอดรวม</span>
                          <span className="text-base font-black text-primary">{baht(o.final_amount)}</span>
                        </div>

                        <Link
                          to="/order-status"
                          className="w-full rounded-xl py-2 text-xs font-bold bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                          <span>ตรวจบิล &amp; คิดเงิน (แคชเชียร์)</span>
                        </Link>
                      </div>
                    );
                  })}

                {tables.filter((t) => t.status === "occupied").length === 0 &&
                  activeOrders.filter((o) => o.order_type === "takeaway" || !o.table_id).length === 0 && (
                    <div className={cn(bento, "p-8 text-center text-muted-foreground border-dashed")}>
                      <Utensils className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-500" />
                      <p className="text-xs font-semibold">ไม่มีโต๊ะหรือออเดอร์ค้างชำระในขณะนี้</p>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BILLING MODAL (ตรวจบิล & รับเงินบนแท็บเล็ต) ── */}
      {billingTable && (
        <Modal
          title={
            <div>
              <p className="text-[11px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
                BILLING &amp; CHECKOUT
              </p>
              <p className="text-xl font-black">โต๊ะ: {billingTable.code}</p>
            </div>
          }
          onClose={() => setBillingTable(null)}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Ordered Items List */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              {selectedTableItems.length > 0 ? (
                selectedTableItems.map((it, idx) => {
                  const m = menu.find((item) => item.id === it.menu_id || item.name === it.menu_name);
                  const drink = isDrinkMenuItem(m || { name: it.menu_name, category_id: null }, categories);
                  return (
                    <div
                      key={`${it.id}-${idx}`}
                      className="flex justify-between items-start gap-3 border-b border-border/40 pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{it.menu_name} × {it.quantity}</span>
                          {drink && (
                            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                              🥤 เครื่องดื่ม
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{baht(it.unit_price)} / รายการ</p>
                      </div>
                      <span className="text-sm font-bold text-primary shrink-0">{baht(it.subtotal)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  ไม่มีรายการอาหารค้างชำระ
                </div>
              )}
            </div>

            {/* Price Summary */}
            <div className="rounded-2xl bg-muted/40 p-4 space-y-2 text-sm border border-border/60">
              <div className="flex justify-between text-muted-foreground">
                <span>ยอดก่อนส่วนลด</span>
                <span>{baht(selectedTableSubtotal)}</span>
              </div>
              {selectedTableDiscount > 0 && (
                <div className="flex justify-between text-primary font-medium">
                  <span>ส่วนลด</span>
                  <span>- {baht(selectedTableDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-border font-bold text-base">
                <span className="font-extrabold text-foreground">ยอดรวมทั้งหมด</span>
                <span className="text-2xl font-black text-primary">{baht(selectedTableTotal)}</span>
              </div>
            </div>

            {/* Payment form */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">
                  วิธีชำระเงิน <span className="text-primary">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="">เลือกวิธีชำระ:</option>
                  <option value="cash">💵 เงินสด (Cash)</option>
                  <option value="transfer">📱 โอนเงิน / พร้อมเพย์ (PromptPay QR)</option>
                  <option value="card">💳 บัตรเครดิต / เดบิต</option>
                  <option value="other">🏷️ อื่น ๆ / บัตรกำนัล</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">
                  เลขอ้างอิง (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="ระบุเลขอ้างอิงสลิป / รหัสธุรกรรม..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                disabled={isCheckingOut || !paymentMethod}
                onClick={handleCheckoutAndReset}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-99"
              >
                {isCheckingOut ? (
                  <span>กำลังบันทึก...</span>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    <span>รับชำระเงินและรีเซ็ตโต๊ะ</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl border border-border bg-card py-2 text-xs font-bold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> พิมพ์บิล / Slip
                </button>
                <button
                  type="button"
                  onClick={() => setBillingTable(null)}
                  className="rounded-xl border border-border bg-card py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ConsoleLayout>
  );
}
