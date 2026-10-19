import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  ReceiptText,
  ShoppingBag,
  Minus,
  Plus,
  X,
  UtensilsCrossed,
  ClipboardList,
  CheckCircle2,
  Clock,
  ChefHat,
  ChevronRight,
  Flame,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { FoodItemDetailModal, type FoodItemSelection, isKabKhaoItem } from "@/components/food-item-detail-modal";
import {
  baht,
  createOrder,
  db,
  fetchCategories,
  fetchMenu,
  fetchPromotions,
  fetchSettings,
  fetchTables,
  createServiceCall,
  type MenuItem,
  type CartLine,
  type Order,
  type OrderStatus,
  type Promotion,
  type RestaurantTable,
  type ServiceCall,
} from "@/lib/restaurant";
import { applyGlobalTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/table/$tableId")({
  head: () => ({
    meta: [
      { title: "สั่งอาหารที่โต๊ะ · Restaurant OS" },
      {
        name: "description",
        content: "สแกน QR แล้วสั่งอาหารได้เองจากโต๊ะของคุณ เลือกเมนู ดูราคา และยืนยันคำสั่งซื้อโดยไม่ต้องเข้าสู่ระบบ",
      },
      { property: "og:title", content: "สั่งอาหารที่โต๊ะ · Restaurant OS" },
      {
        property: "og:description",
        content: "สแกน QR แล้วสั่งอาหารได้เองจากโต๊ะของคุณ เลือกเมนู ดูราคา และยืนยันคำสั่งซื้อโดยไม่ต้องเข้าสู่ระบบ",
      },
    ],
  }),
  component: CustomerMenu,
});

const STATUS_TEXT: Record<OrderStatus, { label: string; tone: string; desc: string }> = {
  waiting: {
    label: "รอครัวรับออเดอร์",
    tone: "bg-warning/15 text-warning border-warning/30",
    desc: "ออเดอร์ถูกส่งเข้าสู่ระบบแล้ว กำลังรอส่งเข้าครัว",
  },
  in_kitchen: {
    label: "กำลังปรุงอาหาร",
    tone: "bg-info/15 text-info border-info/30",
    desc: "เชฟกำลังจัดเตรียมและปรุงอาหารของคุณ",
  },
  served: {
    label: "เสิร์ฟแล้ว",
    tone: "bg-success/15 text-success border-success/30",
    desc: "อาหารเสิร์ฟถึงโต๊ะเรียบร้อย ทานให้อร่อยนะคะ",
  },
  completed: {
    label: "ชำระเงินแล้ว",
    tone: "bg-muted text-muted-foreground border-border",
    desc: "เช็คบิลและชำระเงินเรียบร้อย ขอบคุณที่ใช้บริการ",
  },
  cancelled: {
    label: "ยกเลิกแล้ว",
    tone: "bg-primary/10 text-primary border-primary/20",
    desc: "คำสั่งซื้อถูกยกเลิก",
  },
};

function CustomerMenu() {
  const { tableId } = Route.useParams();

  // Queries for store & menu data (all public read) with live sync
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    refetchInterval: 3000,
  });

  // Real-time subscription to store settings (color/logo/branding updates instantly)
  useEffect(() => {
    const channel = db
      .channel("store-settings-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_settings" },
        () => {
          refetchSettings();
        },
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [refetchSettings]);
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: promotions = [] } = useQuery({ queryKey: ["promotions"], queryFn: fetchPromotions });

  // Flexible table matcher (code, id, or number: e.g. "T01", "1", "01")
  const decodedTableId = useMemo(() => {
    try {
      return decodeURIComponent(tableId || "").trim();
    } catch {
      return (tableId || "").trim();
    }
  }, [tableId]);

  const table = useMemo(() => {
    const norm = decodedTableId.toLowerCase();
    if (!tables.length || !norm) return undefined;

    const direct = tables.find(
      (t) => t.code.toLowerCase() === norm || t.id.toLowerCase() === norm,
    );
    if (direct) return direct;

    const normDigits = norm.replace(/\D/g, "");
    if (normDigits) {
      const matchNum = tables.find((t) => {
        const codeDigits = t.code.replace(/\D/g, "");
        return codeDigits && parseInt(codeDigits, 10) === parseInt(normDigits, 10);
      });
      if (matchNum) return matchNum;
    }

    return tables.find((t) => t.name.toLowerCase().includes(norm));
  }, [tables, decodedTableId]);

  // Direct table query if tables list is not yet loaded or doesn't have it
  const { data: directTable } = useQuery({
    queryKey: ["direct-table", decodedTableId],
    queryFn: async () => {
      const norm = decodedTableId.toLowerCase();
      const digits = norm.replace(/\D/g, "");
      const paddedCode = digits ? `T${digits.padStart(2, "0")}` : norm.toUpperCase();

      const { data } = await db
        .from("tables")
        .select("*")
        .or(`code.ilike.${norm},code.ilike.${paddedCode},id.eq.${norm}`)
        .limit(1)
        .maybeSingle();

      return (data as RestaurantTable) ?? null;
    },
    enabled: !table && Boolean(decodedTableId),
  });

  const activeTable = table || directTable || undefined;

  const displayTableName = useMemo(() => {
    if (activeTable?.name) return activeTable.name;
    const digits = decodedTableId.replace(/\D/g, "");
    if (digits) return `โต๊ะ ${parseInt(digits, 10)}`;
    return `โต๊ะ ${decodedTableId.toUpperCase()}`;
  }, [activeTable, decodedTableId]);

  // Clock
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleString("th-TH", { dateStyle: "full", timeStyle: "short" }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // Customer Session Storage keys
  const cartKey = `pos_table_cart_${decodedTableId}`;
  const ordersKey = `pos_table_orders_${decodedTableId}`;

  // Cart state persisted to sessionStorage
  const [cart, setCart] = useState<Record<string, CartLine>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = sessionStorage.getItem(cartKey);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        const isOldFormat = Object.values(parsed).some((v) => typeof v === "number");
        if (isOldFormat) return {};
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartKey]);

  // Placed Order IDs persisted to sessionStorage
  const [placedOrderIds, setPlacedOrderIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem(ordersKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const recordPlacedOrderId = (orderId: string) => {
    setPlacedOrderIds((prev) => {
      const next = [orderId, ...prev.filter((id) => id !== orderId)];
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(ordersKey, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  // Real-time tracking of placed orders for this table session
  const { data: customerOrders = [], refetch: refetchCustomerOrders } = useQuery({
    queryKey: ["customer-orders", tableId, placedOrderIds],
    queryFn: async () => {
      if (!placedOrderIds.length) return [];
      const { data, error } = await db
        .from("orders")
        .select("*, order_items(*)")
        .in("id", placedOrderIds)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data as Order[]) ?? [];
    },
    enabled: placedOrderIds.length > 0,
  });

  // Subscribe to real-time status updates for customer orders
  useEffect(() => {
    if (!placedOrderIds.length) return;
    const channel = db
      .channel(`customer-orders-live-${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        refetchCustomerOrders();
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [tableId, placedOrderIds, refetchCustomerOrders]);

  const [activeCat, setActiveCat] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [callingBill, setCallingBill] = useState(false);
  const [billCalled, setBillCalled] = useState(false);
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");

  // Real-time tracking of active service calls for this table
  const currentTableId = activeTable?.id;
  const { data: tableCalls = [], refetch: refetchTableCalls } = useQuery({
    queryKey: ["table-calls", currentTableId, decodedTableId],
    queryFn: async () => {
      if (!currentTableId) return [];
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("service_calls")
        .select("*")
        .eq("table_id", currentTableId)
        .eq("resolved", false)
        .gte("created_at", since);
      if (error) return [];
      return (data as ServiceCall[]) ?? [];
    },
    enabled: Boolean(currentTableId),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!currentTableId) return;
    const channel = db
      .channel(`table-calls-${currentTableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_calls", filter: `table_id=eq.${currentTableId}` },
        () => {
          refetchTableCalls();
        },
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [currentTableId, refetchTableCalls]);

  const activeBillCall = useMemo(
    () => tableCalls.find((c) => !c.resolved && (c.message === "เรียกเช็คบิล" || c.message.includes("เช็คบิล"))),
    [tableCalls],
  );

  const isBillCalled = Boolean(billCalled || activeBillCall);

  const handleCallBill = async () => {
    if (callingBill) return;
    setCallingBill(true);
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
      
      let validTableId = activeTable?.id;
      let validTableCode = activeTable?.code || activeTable?.name || decodedTableId;
      
      if (!validTableId) {
        const norm = decodedTableId.toLowerCase();
        const digits = norm.replace(/\D/g, "");
        const paddedCode = digits ? `T${digits.padStart(2, "0")}` : norm.toUpperCase();

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(norm);
        const orQuery = isUuid 
          ? `code.ilike.${norm},code.ilike.${paddedCode},id.eq.${norm}` 
          : `code.ilike.${norm},code.ilike.${paddedCode}`;

        const { data } = await db
          .from("tables")
          .select("id, code, name")
          .or(orQuery)
          .limit(1)
          .maybeSingle();
          
        if (data) {
           validTableId = data.id;
           validTableCode = data.code || data.name;
        } else {
           throw new Error("ไม่พบข้อมูลโต๊ะที่ถูกต้อง");
        }
      }

      await createServiceCall(validTableId, "เรียกเช็คบิล", validTableCode);
      setBillCalled(true);
      refetchTableCalls();
      toast.success(`🧾 แจ้งเรียกเช็คบิล ${displayTableName} เรียบร้อยแล้ว พนักงานกำลังมาที่โต๊ะ`, {
        duration: 6000,
      });
    } catch (err) {
      console.error("เรียกเช็คบิลผิดพลาด:", err);
      toast.error("ไม่สามารถแจ้งได้ กรุณาลองใหม่อีกครั้ง หรือเรียกพนักงานโดยตรง");
    } finally {
      setCallingBill(false);
    }
  };

  // ── Single Dish category detection ──────────────────────────────
  const singleDishCategory = useMemo(() => {
    return categories.find(
      (c) =>
        c.name.includes("อาหารจานเดียว") ||
        c.name.includes("จานเดียว") ||
        c.code === "CAT_RICE" ||
        c.id === "c2",
    );
  }, [categories]);

  const isSingleDishItem = (item: MenuItem) => {
    if (singleDishCategory && item.category_id === singleDishCategory.id) return true;
    if (item.category_id === "c2") return true;
    const cat = categories.find((c) => c.id === item.category_id);
    if (
      cat &&
      (cat.name.includes("อาหารจานเดียว") ||
        cat.name.includes("จานเดียว") ||
        cat.code === "CAT_RICE")
    ) {
      return true;
    }
    if (activeCat === singleDishCategory?.id || (singleDishCategory && activeCat === "c2")) {
      return true;
    }
    return false;
  };

  const isKabKhaoCategoryItem = (item: MenuItem | null) => {
    if (!item) return false;
    if (isKabKhaoItem(item)) return true;
    const cat = categories.find((c) => c.id === item.category_id);
    if (
      cat &&
      (cat.name.includes("กับข้าว") ||
        cat.code === "CAT_DISH" ||
        cat.id === "c3" ||
        cat.id === "99fbb89e-e8f7-49ca-b622-542b30b3627a")
    ) {
      return true;
    }
    return false;
  };

  const isNoteOnlyItem = (item: MenuItem | null) => {
    if (!item) return false;
    // อาหารจานเดียว และ กับข้าว ไม่ใช่ note-only (มีตัวเลือกเพิ่มความอร่อย)
    if (isSingleDishItem(item) || isKabKhaoCategoryItem(item)) {
      return false;
    }
    return true;
  };

  const filtered = useMemo(() => {
    return menu.filter((m) => {
      const matchCat =
        activeCat === "all" ||
        (activeCat === "popular" ? m.is_popular : m.category_id === activeCat);
      if (!matchCat) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.name.toLowerCase().includes(q);
        const matchCode = m.code.toLowerCase().includes(q);
        const matchDesc = (m.description || "").toLowerCase().includes(q);
        return matchName || matchCode || matchDesc;
      }
      return true;
    });
  }, [menu, activeCat, searchQuery]);

  const lines = useMemo(
    () => Object.values(cart).filter((l) => l.qty > 0),
    [cart],
  );

  const subtotal = lines.reduce((s, l) => s + (l.unitPrice ?? l.item.price) * l.qty, 0);
  const discount = (subtotal * discountPct) / 100;
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  const getItemTotalQty = (itemId: string) => {
    return Object.values(cart)
      .filter((l) => l.item.id === itemId)
      .reduce((sum, l) => sum + l.qty, 0);
  };

  const handleAddToCartSelection = (selection: FoodItemSelection) => {
    if (!selection.itemId) return;
    const targetItem = menu.find((m) => m.id === selection.itemId);
    if (!targetItem) return;

    const lineKey = [
      targetItem.id,
      selection.selectedPortion?.id || "portion-regular",
      selection.selectedSpice?.id || "default",
      (selection.selectedAddOns || []).map((a) => a.id).sort().join(","),
      (selection.note || "").trim(),
    ].join("::");

    setCart((prev) => {
      const existing = prev[lineKey];
      const newQty = (existing?.qty ?? 0) + selection.quantity;
      return {
        ...prev,
        [lineKey]: {
          id: lineKey,
          item: targetItem,
          qty: newQty,
          unitPrice: selection.unitPrice,
          selectedPortion: selection.selectedPortion,
          selectedSpice: selection.selectedSpice,
          selectedAddOns: selection.selectedAddOns,
          note: selection.note,
          summaryText: selection.summaryText,
        },
      };
    });

    toast.success(`เพิ่ม ${targetItem.name} ลงตะกร้าแล้ว`);
  };

  const setRegularItemQty = (item: MenuItem, delta: number) => {
    if (item.status === "out_of_stock") {
      toast.error(`${item.name} หมดแล้ว`);
      return;
    }
    const lineKey = item.id;
    setCart((prev) => {
      const existing = prev[lineKey];
      const nextQty = Math.max(0, (existing?.qty ?? 0) + delta);
      const copy = { ...prev };
      if (nextQty === 0) {
        delete copy[lineKey];
      } else {
        copy[lineKey] = {
          id: lineKey,
          item,
          qty: nextQty,
          unitPrice: item.price,
        };
      }
      return copy;
    });
    if (delta > 0) toast.success(`เพิ่ม ${item.name} แล้ว`);
  };

  const updateCartLineQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[lineId];
      if (!existing) return prev;
      const nextQty = Math.max(0, existing.qty + delta);
      const copy = { ...prev };
      if (nextQty === 0) {
        delete copy[lineId];
      } else {
        copy[lineId] = { ...existing, qty: nextQty };
      }
      return copy;
    });
  };

  const confirm = async () => {
    if (lines.length === 0) {
      toast.error("ยังไม่มีรายการในตะกร้า");
      return;
    }
    setSaving(true);
    try {
      const order = await createOrder({
        lines,
        tableId: activeTable?.id ?? null,
        orderType: "dine_in",
        customerName: `ลูกค้า ${displayTableName}`,
        customerCount: 1,
        discountAmount: discount,
      });

      recordPlacedOrderId(order.id);
      toast.success(`ส่งคำสั่งซื้อสำเร็จ · เลขที่ ${order.order_number}`);
      setCart({});
      setDiscountPct(0);
      setCartOpen(false);
      setOrdersOpen(true);
      refetchCustomerOrders();
    } catch {
      toast.error("ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const activePromoList = useMemo(
    () => promotions.filter((p) => p.status === "active"),
    [promotions],
  );

  const primaryColor = settings?.primary_color || "#E53E3E";
  const secondaryColor = settings?.secondary_color || "#10B981";

  // Apply store branding colors to document root so all components reflect changes
  useEffect(() => {
    applyGlobalTheme(primaryColor, secondaryColor);
  }, [primaryColor, secondaryColor]);

  return (
    <div
      className="min-h-screen bg-stone-50/90 dark:bg-stone-950 text-foreground pb-32"
      style={
        {
          "--primary": primaryColor,
          "--color-primary": primaryColor,
          "--primary-dark": primaryColor,
          "--color-primary-dark": primaryColor,
          "--secondary": secondaryColor,
          "--color-secondary": secondaryColor,
        } as React.CSSProperties
      }
    >
      {/* Header Banner */}
      <header
        className="relative px-3.5 py-4 sm:px-8 sm:py-6 text-white shadow-md overflow-hidden"
        style={{
          backgroundColor: primaryColor,
          backgroundImage: settings?.banner_url
            ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.78)), url(${settings.banner_url})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto grid max-w-5xl gap-2.5 sm:gap-3 relative z-10">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur shadow-sm overflow-hidden border border-white/25">
                {settings?.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt={settings.store_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base sm:text-2xl font-bold text-white tracking-tight">
                  {settings?.store_name ?? "Restaurant"}
                </h1>
                <p className="truncate text-[11px] sm:text-xs text-white/85">{settings?.tagline}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {placedOrderIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrdersOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/20 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold backdrop-blur hover:bg-white/30 transition-colors text-white"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">สถานะอาหาร</span>
                  <span
                    className="grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[10px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {customerOrders.length}
                  </span>
                </button>
              )}
              <span className="hidden sm:inline-block shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs backdrop-blur text-white">
                {now}
              </span>
            </div>
          </div>

          <div className="mt-0.5 rounded-2xl bg-white/15 p-3 sm:p-4 backdrop-blur border border-white/20 text-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base sm:text-lg font-bold text-white leading-tight">
                  ยินดีต้อนรับ {displayTableName}
                </p>
                <p className="text-xs sm:text-sm text-white/90 mt-0.5">
                  {settings?.hero_subtitle ?? "สแกน สั่ง อร่อย ได้เลยที่โต๊ะของคุณ"}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 sm:px-3 text-[11px] sm:text-xs font-semibold text-white shadow-sm shrink-0"
                style={{ backgroundColor: secondaryColor }}
              >
                ● สั่งได้ทันที ไม่ต้องล็อกอิน
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Menu Feed */}
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-8">
        {/* Search Bar & Layout Switcher */}
        <div className="mb-4 flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อเมนูอาหาร หรือ รหัสเมนู..."
              className="w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-9 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
                aria-label="ล้างการค้นหา"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* View Mode Toggle (Grid vs List) */}
          <div className="flex items-center rounded-2xl border border-border bg-card p-1 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => setLayoutMode("grid")}
              style={layoutMode === "grid" ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-xl transition-all cursor-pointer",
                layoutMode === "grid"
                  ? "shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="มุมมองการ์ดใหญ่ (Grid)"
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("list")}
              style={layoutMode === "list" ? { backgroundColor: primaryColor, color: "#ffffff" } : undefined}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-xl transition-all cursor-pointer",
                layoutMode === "list"
                  ? "shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="มุมมองรายการแถวยาวกะทัดรัด (List)"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <CatPill active={activeCat === "all"} activeColor={primaryColor} onClick={() => setActiveCat("all")}>
            เมนูอาหารทั้งหมด
          </CatPill>
          <CatPill active={activeCat === "popular"} activeColor={primaryColor} onClick={() => setActiveCat("popular")}>
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" style={{ color: activeCat === "popular" ? "#ffffff" : primaryColor }} /> แนะนำพิเศษ
            </span>
          </CatPill>
          {categories
            .filter((c) => c.code !== "CAT_POPULAR" && !c.name.includes("ยอดนิยม"))
            .map((c) => (
              <CatPill key={c.id} active={activeCat === c.id} activeColor={primaryColor} onClick={() => setActiveCat(c.id)}>
                {c.name}
              </CatPill>
            ))}
        </div>

        {/* Empty Search Result State */}
        {filtered.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center shadow-sm">
            <UtensilsCrossed className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="font-bold text-foreground">ไม่พบรายการอาหารที่ค้นหา</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchQuery ? `ไม่พบเมนูที่ตรงกับ "${searchQuery}"` : "ยังไม่มีรายการอาหารในหมวดหมู่นี้"}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 rounded-xl bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
              >
                ล้างคำค้นหา
              </button>
            )}
          </div>
        ) : layoutMode === "list" ? (
          /* Menu List Layout (รายการแถวยาวกะทัดรัด) */
          <div className="flex flex-col gap-2.5">
            {filtered.map((item) => {
              const totalItemQty = getItemTotalQty(item.id);
              return (
                <article
                  key={item.id}
                  onClick={() => {
                    if (item.status === "available") {
                      setModalItem(item);
                    }
                  }}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-bento transition-all duration-200 hover:shadow-bento-lg",
                    item.status === "available" && "cursor-pointer hover:border-primary/40",
                    item.status === "out_of_stock" && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {/* Thumbnail Image */}
                  <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className={cn(
                          "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                          item.status === "out_of_stock" && "grayscale opacity-60",
                        )}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <UtensilsCrossed className="h-6 w-6 opacity-40" />
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
                      {item.code}
                    </span>
                    {item.status === "out_of_stock" && (
                      <span className="absolute inset-0 grid place-items-center bg-black/60 text-[10px] font-bold text-white backdrop-blur-[1px]">
                        หมด
                      </span>
                    )}
                  </div>

                  {/* Item Info */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <h2 className="font-bold text-sm sm:text-base leading-snug text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {item.name}
                    </h2>
                    <p className="line-clamp-1 sm:line-clamp-2 text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-base sm:text-lg font-bold" style={{ color: primaryColor }}>{baht(item.price)}</span>
                      {item.is_popular && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <Flame className="h-3.5 w-3.5" /> ยอดนิยม
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add Action Button */}
                  <div className="shrink-0 pl-1" onClick={(e) => e.stopPropagation()}>
                    {item.status === "available" && (
                      totalItemQty > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold"
                            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                          >
                            {totalItemQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setModalItem(item)}
                            style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                            className="rounded-full px-3 py-1.5 text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                          >
                            + เพิ่มอีก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setModalItem(item)}
                          style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                          className="rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                        >
                          + เพิ่ม
                        </button>
                      )
                    )}
                    {item.status === "out_of_stock" && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        สินค้าหมด
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Menu Grid Layout (การ์ดรูปใหญ่) */
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const totalItemQty = getItemTotalQty(item.id);
              return (
                <article
                  key={item.id}
                  onClick={() => {
                    if (item.status === "available") {
                      setModalItem(item);
                    }
                  }}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-bento transition-all duration-200 hover:-translate-y-1 hover:shadow-bento-lg",
                    item.status === "available" && "cursor-pointer",
                    item.status === "out_of_stock" && "opacity-60 cursor-not-allowed",
                  )}
                >
                  <div className="relative h-32 sm:h-44 bg-muted overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className={cn(
                          "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                          item.status === "out_of_stock" && "grayscale opacity-60",
                        )}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <UtensilsCrossed className="h-7 w-7 sm:h-8 sm:w-8 opacity-40" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-md bg-foreground/75 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-background backdrop-blur">
                      {item.code}
                    </span>
                    {item.status === "out_of_stock" && (
                      <span className="absolute inset-0 grid place-items-center bg-black/50 text-xs sm:text-sm font-bold text-white backdrop-blur-[2px]">
                        สินค้าหมด
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between space-y-2 p-2.5 sm:p-4">
                    <div className="min-h-[2.2rem] sm:min-h-[2.5rem]">
                      <h2 className="font-bold text-xs sm:text-base leading-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">{item.name}</h2>
                      <p className="line-clamp-1 sm:line-clamp-2 text-[11px] sm:text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>

                    <div
                      className="flex items-center justify-between gap-1 sm:gap-2 pt-1.5 sm:pt-2 border-t border-border/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-sm sm:text-lg font-bold" style={{ color: primaryColor }}>{baht(item.price)}</span>
                      {item.status === "available" && (
                        totalItemQty > 0 ? (
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <span
                              className="rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold"
                              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                            >
                              {totalItemQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => setModalItem(item)}
                              style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                              className="rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold shadow-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                            >
                              + เพิ่มอีก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setModalItem(item)}
                            style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                            className="rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold shadow-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                          >
                            + เพิ่ม
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Mobile Bottom Action Dock (เฉพาะจอโทรศัพท์มือถือ sm:hidden) ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-3 py-2.5 shadow-bento-lg flex items-center gap-2">
        {/* Call Staff */}
        <button
          type="button"
          onClick={() => setCallOpen(true)}
          className="flex flex-col items-center justify-center min-w-[50px] h-12 rounded-xl border border-border bg-card text-[10px] font-semibold text-foreground active:scale-95 transition-transform cursor-pointer"
        >
          <BellRing className="h-4 w-4 mb-0.5" style={{ color: primaryColor }} />
          <span>พนักงาน</span>
        </button>

        {/* Call Bill */}
        <button
          type="button"
          onClick={handleCallBill}
          disabled={callingBill}
          className={cn(
            "flex flex-col items-center justify-center min-w-[50px] h-12 rounded-xl border text-[10px] font-semibold active:scale-95 transition-transform disabled:opacity-60 cursor-pointer",
            isBillCalled
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold"
              : "border-border bg-card text-foreground"
          )}
        >
          {isBillCalled ? (
            <CheckCircle2 className="h-4 w-4 mb-0.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ReceiptText className="h-4 w-4 mb-0.5 text-success" />
          )}
          <span>{isBillCalled ? "แจ้งแล้ว" : "เช็คบิล"}</span>
        </button>

        {/* Order Status (if placed orders exist) */}
        {placedOrderIds.length > 0 && (
          <button
            type="button"
            onClick={() => setOrdersOpen(true)}
            className="relative flex flex-col items-center justify-center min-w-[50px] h-12 rounded-xl border border-border bg-card text-[10px] font-semibold text-foreground active:scale-95 transition-transform cursor-pointer"
          >
            <ClipboardList className="h-4 w-4 mb-0.5" style={{ color: primaryColor }} />
            <span>สถานะ</span>
            <span
              className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[9px] font-bold text-white shadow-xs"
              style={{ backgroundColor: primaryColor }}
            >
              {customerOrders.length}
            </span>
          </button>
        )}

        {/* Main Cart CTA Button */}
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          style={{ backgroundColor: primaryColor, color: "#ffffff" }}
          className="flex-1 flex items-center justify-between h-12 rounded-xl px-3.5 text-sm font-bold text-white shadow-glow active:scale-[0.98] transition-transform cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-4.5 w-4.5" />
            <span>ตะกร้า</span>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/25 px-1 text-xs font-bold text-white">
              {totalQty}
            </span>
          </div>
          <span className="text-xs sm:text-sm font-bold">
            {subtotal > 0 ? baht(subtotal) : "ดูรายการ"}
          </span>
        </button>
      </div>

      {/* ── Desktop Floating Action Buttons (สำหรับจอแท็บเล็ตและคอมพิวเตอร์ hidden sm:flex) ── */}
      <div className="hidden sm:flex fixed bottom-5 left-4 z-40 flex-col gap-2">
        <button
          onClick={() => setCallOpen(true)}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold shadow-bento-lg transition-transform active:scale-95"
        >
          <BellRing className="h-4 w-4" style={{ color: primaryColor }} /> แจ้งพนักงาน
        </button>
        <button
          id="btn-call-bill"
          onClick={handleCallBill}
          disabled={callingBill}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-bento-lg transition-all active:scale-95 disabled:opacity-60",
            isBillCalled
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold"
              : "border-border bg-card text-foreground"
          )}
        >
          {isBillCalled ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>แจ้งเรียกเช็คบิลแล้ว</span>
            </>
          ) : (
            <>
              <ReceiptText className="h-4 w-4 text-success" />
              <span>{callingBill ? "กำลังแจ้ง..." : "เรียกเช็คบิล"}</span>
            </>
          )}
        </button>
      </div>

      <div className="hidden sm:flex fixed bottom-5 right-4 z-40 flex-col items-end gap-2">
        {placedOrderIds.length > 0 && (
          <button
            onClick={() => setOrdersOpen(true)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-xs font-bold shadow-bento-lg transition-transform active:scale-95"
          >
            <ClipboardList className="h-4 w-4" style={{ color: primaryColor }} />
            <span>สถานะอาหาร</span>
            <span
              className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {customerOrders.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setCartOpen(true)}
          style={{ backgroundColor: primaryColor, color: "#ffffff" }}
          className="flex items-center gap-2.5 rounded-full px-5 py-4 text-sm font-bold text-white shadow-glow transition-transform active:scale-95 cursor-pointer"
        >
          <ShoppingBag className="h-5 w-5" />
          ตะกร้า ({totalQty})
        </button>
      </div>

      {/* Cart Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-card shadow-bento-lg transition-transform duration-300",
          cartOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border p-4">
          <div>
            <h2 className="text-lg font-bold">รายการที่เลือก</h2>
            <p className="text-xs text-muted-foreground">{displayTableName}</p>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="ปิดตะกร้า"
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {lines.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto h-10 w-10 opacity-30" />
              <p className="mt-2 text-sm">ยังไม่มีรายการในตะกร้า</p>
              <p className="text-xs text-muted-foreground/80">เลือกเมนูอาหารด้านบนเพื่อสั่งได้เลย</p>
            </div>
          )}

          {lines.map((l, i) => {
            const lineKey = l.id || `${l.item.id}-${i}`;
            const unitPrice = l.unitPrice ?? l.item.price;
            return (
              <div
                key={lineKey}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-muted/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.item.name}</p>
                  {l.summaryText && (
                    <p className="line-clamp-1 text-[11px] font-medium mt-0.5" style={{ color: primaryColor }}>
                      {l.summaryText}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {baht(unitPrice)} × {l.qty} ={" "}
                    <span className="font-bold" style={{ color: primaryColor }}>{baht(unitPrice * l.qty)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Stepper
                    qty={l.qty}
                    onMinus={() => updateCartLineQty(lineKey, -1)}
                    onPlus={() => updateCartLineQty(lineKey, 1)}
                  />
                  <button
                    type="button"
                    onClick={() => updateCartLineQty(lineKey, -l.qty)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 active:scale-95 ml-1 cursor-pointer"
                    title="ลบรายการ"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div className="space-y-1 text-sm pt-1">
            <div className="flex justify-between pt-2 text-lg font-bold">
              <span>ยอดสุทธิ</span>
              <span style={{ color: primaryColor }}>{baht(subtotal)}</span>
            </div>
          </div>

          <button
            onClick={confirm}
            disabled={saving || lines.length === 0}
            style={{ backgroundColor: primaryColor, color: "#ffffff" }}
            className="w-full rounded-xl px-4 py-3.5 text-sm font-bold text-white shadow-glow disabled:opacity-60 transition-transform active:scale-[0.98] cursor-pointer"
          >
            {saving ? "กำลังส่งคำสั่งซื้อ..." : "ยืนยันคำสั่งซื้อ"}
          </button>
        </div>
      </div>

      {/* Placed Orders Tracking Modal */}
      {ordersOpen && (
        <Modal
          title={`สถานะอาหาร · ${displayTableName}`}
          onClose={() => setOrdersOpen(false)}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {customerOrders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ClipboardList className="mx-auto h-10 w-10 opacity-30" />
                <p className="mt-2 text-sm">ยังไม่มีประวัติการสั่งอาหารในเซสชันนี้</p>
              </div>
            ) : (
              customerOrders.map((order) => {
                const statusMeta = STATUS_TEXT[order.status] ?? {
                  label: order.status,
                  tone: "bg-muted text-foreground border-border",
                  desc: "",
                };

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <div>
                        <p className="text-xs font-mono font-bold" style={{ color: primaryColor }}>
                          {order.order_number}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} น.
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-bold",
                          statusMeta.tone,
                        )}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">{statusMeta.desc}</p>

                    <div className="space-y-1 text-xs">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="flex justify-between py-0.5">
                          <span>
                            {item.menu_name} × {item.quantity}
                          </span>
                          <span className="font-medium text-foreground">
                            {baht(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between border-t border-border/60 pt-2 text-sm font-bold">
                      <span>ยอดชำระ</span>
                      <span className="font-bold" style={{ color: primaryColor }}>{baht(order.final_amount)}</span>
                    </div>
                  </div>
                );
              })
            )}

            <button
              type="button"
              onClick={handleCallBill}
              disabled={callingBill}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all shadow-xs disabled:opacity-60 active:scale-95",
                isBillCalled
                  ? "border border-emerald-600 bg-emerald-600 text-white animate-pulse"
                  : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25"
              )}
            >
              <ReceiptText className="h-4 w-4" />
              {isBillCalled ? "แจ้งเรียกเช็คบิลแล้ว ✓ (พนักงานกำลังมา)" : callingBill ? "กำลังแจ้งพนักงาน..." : "เรียกเช็คบิลที่โต๊ะ"}
            </button>

            <button
              type="button"
              onClick={() => setOrdersOpen(false)}
              className="w-full rounded-xl border border-border bg-muted/40 py-2.5 text-xs font-semibold hover:bg-muted"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </Modal>
      )}

      {/* Staff Call Modal */}
      {callOpen && (
        <Modal title="แจ้งพนักงาน" onClose={() => setCallOpen(false)}>
          <div className="grid gap-2">
            {[
              "เรียกเช็คบิล",
              "ขอน้ำเปล่า / น้ำแข็ง",
              "ขอช้อนส้อม / จานแบ่งเพิ่ม",
              "ขอกระดาษทิชชู่",
              "สอบถามรายการอาหาร",
              "ตามรายการอาหารที่สั่ง",
            ].map((r) => (
              <button
                key={r}
                onClick={async () => {
                  if (r === "เรียกเช็คบิล") {
                    await handleCallBill();
                    setCallOpen(false);
                    return;
                  }
                  
                  try {
                    let validTableId = activeTable?.id;
                    let validTableCode = activeTable?.code || activeTable?.name || decodedTableId;
                    
                    if (!validTableId) {
                      const norm = decodedTableId.toLowerCase();
                      const digits = norm.replace(/\D/g, "");
                      const paddedCode = digits ? `T${digits.padStart(2, "0")}` : norm.toUpperCase();

                      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(norm);
                      const orQuery = isUuid 
                        ? `code.ilike.${norm},code.ilike.${paddedCode},id.eq.${norm}` 
                        : `code.ilike.${norm},code.ilike.${paddedCode}`;

                      const { data } = await db
                        .from("tables")
                        .select("id, code, name")
                        .or(orQuery)
                        .limit(1)
                        .maybeSingle();
                        
                      if (data) {
                         validTableId = data.id;
                         validTableCode = data.code || data.name;
                      } else {
                         throw new Error("ไม่พบข้อมูลโต๊ะที่ถูกต้อง");
                      }
                    }

                    await createServiceCall(validTableId, r, validTableCode);
                    toast.success(`แจ้งพนักงานแล้ว: ${r} (พนักงานกำลังมาที่โต๊ะ)`);
                  } catch (err) {
                    console.error("เรียกพนักงานผิดพลาด:", err);
                    toast.error("เรียกพนักงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
                  } finally {
                    setCallOpen(false);
                  }
                }}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all active:scale-[0.99]",
                  r === "เรียกเช็คบิล"
                    ? isBillCalled
                      ? "border-emerald-600 bg-emerald-600 font-bold text-white shadow-sm animate-pulse"
                      : "border-emerald-500/40 bg-emerald-500/10 font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
                    : "border-border hover:border-primary hover:bg-primary/5"
                )}
              >
                {r === "เรียกเช็คบิล" ? (isBillCalled ? "🧾 แจ้งเรียกเช็คบิลแล้ว ✓ (พนักงานกำลังมา)" : "🧾 เรียกเช็คบิล") : r}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Food Item Detail Modal (อาหารจานเดียว หรือ กับข้าว/น้ำ มีแค่หมายเหตุ) ─────────────── */}
      <FoodItemDetailModal
        isOpen={Boolean(modalItem)}
        onClose={() => setModalItem(null)}
        item={modalItem}
        isNoteOnly={modalItem ? isNoteOnlyItem(modalItem) : false}
        onAddToCart={handleAddToCartSelection}
        primaryColor={primaryColor}
      />
    </div>
  );
}

function CatPill({
  active,
  onClick,
  children,
  activeColor,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={active && activeColor ? { backgroundColor: activeColor, borderColor: activeColor, color: "#ffffff" } : undefined}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-glow"
          : "border border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Stepper({
  qty,
  onMinus,
  onPlus,
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-0.5 border border-border/40">
      <button
        aria-label="ลด"
        onClick={onMinus}
        className="grid h-7 w-7 place-items-center rounded-full bg-card shadow-sm hover:text-primary transition-colors"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-semibold">{qty}</span>
      <button
        aria-label="เพิ่ม"
        onClick={onPlus}
        className="grid h-7 w-7 place-items-center rounded-full bg-card shadow-sm hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
