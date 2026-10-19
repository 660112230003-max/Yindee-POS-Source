import { supabase } from "@/integrations/supabase/client";
import { getLocalTelegramConfig, sendTelegramServiceAlert, sendTelegramKitchenReadyAlert } from "./telegram";

/* ---------------------------------- types --------------------------------- */

export type MenuStatus = "available" | "out_of_stock";
export type TableZone = "indoor" | "terrace";
export type TableStatus = "available" | "occupied" | "disabled";
export type DiscountType = "percentage" | "fixed_amount";
export type PromoStatus = "active" | "inactive";
export type OrderType = "dine_in" | "takeaway";
export type OrderStatus = "waiting" | "in_kitchen" | "served" | "completed" | "cancelled";

export type Category = {
  id: string;
  name: string;
  code: string;
  display_order: number;
};


export type MenuItem = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  price: number;
  description: string;
  image_url: string | null;
  is_popular: boolean;
  display_order: number;
  status: MenuStatus;
};

export type RestaurantTable = {
  id: string;
  code: string;
  name: string;
  zone: TableZone;
  status: TableStatus;
  qr_code_url: string | null;
};

export type Promotion = {
  id: string;
  title: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  min_spend: number;
  start_date: string | null;
  end_date: string | null;
  banner_url: string | null;
  status: PromoStatus;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_id: string | null;
  menu_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type Order = {
  id: string;
  order_number: string;
  table_id: string | null;
  order_type: OrderType;
  customer_name: string;
  customer_count: number;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  status: OrderStatus;
  created_at: string;
  note?: string | null;
  order_items?: OrderItem[];
};

export type ServiceCall = {
  id: string;
  table_id: string;
  message: string;
  resolved: boolean;
  created_at: string;
};

export type StoreSettings = {
  id: string;
  store_name: string;
  system_name: string;
  tagline: string;
  logo_url: string | null;
  banner_url: string | null;
  hero_title: string;
  hero_subtitle: string;
  primary_color: string;
  secondary_color: string;
  vat_rate: number;
  service_charge_rate: number;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_kitchen_chat_id?: string | null;
  telegram_notify_enabled?: boolean;
};

export type StaffUser = {
  id: string;
  name: string;
  username?: string | null;
  password?: string | null;
  pin?: string | null;
  role_id: string;
  is_active: boolean;
  created_at: string;
};

/* ------------------------------ mock fallback ----------------------------- */

const img = (id: string) => `https://images.unsplash.com/${id}?w=800&q=70`;

export const MOCK_CATEGORIES: Category[] = [
  { id: "c2", name: "อาหารจานเดียว", code: "CAT_RICE", display_order: 1 },
  { id: "c3", name: "กับข้าว", code: "CAT_DISH", display_order: 2 },
  { id: "c4", name: "เครื่องดื่ม", code: "CAT_DRINK", display_order: 3 },
  { id: "c5", name: "เครื่องเคียง", code: "CAT_SIDE", display_order: 4 },
];

export const MOCK_MENU: MenuItem[] = [
  {
    id: "m1",
    code: "M001",
    name: "ข้าวกะเพราหมูสับไข่ดาว",
    category_id: "c2",
    price: 75,
    description: "กะเพราหอมกรอบ ผัดไฟแรง เสิร์ฟพร้อมไข่ดาวกรอบ",
    image_url: img("photo-1569058242567-93de6f36f8e6"),
    is_popular: true,
    display_order: 1,
    status: "available",
  },
  {
    id: "m2",
    code: "M002",
    name: "ข้าวผัดกุ้ง",
    category_id: "c2",
    price: 90,
    description: "ข้าวผัดหอมกลิ่นกระทะ กุ้งสดตัวโต",
    image_url: img("photo-1603133872878-684f208fb84b"),
    is_popular: true,
    display_order: 2,
    status: "available",
  },
  {
    id: "m3",
    code: "M006",
    name: "ต้มยำกุ้งน้ำข้น",
    category_id: "c3",
    price: 180,
    description: "เข้มข้นจัดจ้าน กุ้งแม่น้ำตัวโต",
    image_url: img("photo-1548943487-a2e4e43b4853"),
    is_popular: true,
    display_order: 3,
    status: "available",
  },
  {
    id: "m4",
    code: "M010",
    name: "ทอดมันกุ้ง",
    category_id: "c3",
    price: 90,
    description: "เนื้อกุ้งบดผสมเครื่องเทศ ปั้นเป็นก้อนแล้วนำไปทอด",
    image_url: img("photo-1626082927389-6cd097cdc6ec"),
    is_popular: false,
    display_order: 4,
    status: "out_of_stock",
  },
  {
    id: "m5",
    code: "M012",
    name: "ชาเย็น",
    category_id: "c4",
    price: 45,
    description: "ชาไทยแท้ หวานมัน",
    image_url: img("photo-1558857563-b371033873b8"),
    is_popular: true,
    display_order: 5,
    status: "available",
  },
  {
    id: "m6",
    code: "M016",
    name: "ข้าวเหนียวมะม่วง",
    category_id: "c5",
    price: 120,
    description: "มะม่วงน้ำดอกไม้สุกหอม",
    image_url: img("photo-1621293954908-907159247fc8"),
    is_popular: true,
    display_order: 6,
    status: "available",
  },
];

export const MOCK_TABLES: RestaurantTable[] = Array.from({ length: 13 }, (_, i) => ({
  id: `t${i + 1}`,
  code: `T${String(i + 1).padStart(2, "0")}`,
  name: `โต๊ะ ${i + 1}`,
  zone: i < 7 ? "indoor" : "terrace",
  status: i === 2 || i === 8 ? "occupied" : i === 11 ? "disabled" : "available",
  qr_code_url: null,
}));

export const MOCK_PROMOTIONS: Promotion[] = [
  {
    id: "p1",
    title: "ส่วนลด 10%",
    code: "PROMO10",
    description: "ลด 10% ทุกเมนู เมื่อสั่งครบ 300 บาท",
    discount_type: "percentage",
    discount_value: 10,
    min_spend: 300,
    start_date: null,
    end_date: null,
    banner_url: null,
    status: "active",
  },
  {
    id: "p2",
    title: "โปรวันเกิด 15%",
    code: "BDAY15",
    description: "ลด 15% สำหรับลูกค้าวันเกิดเดือนนี้",
    discount_type: "percentage",
    discount_value: 15,
    min_spend: 0,
    start_date: null,
    end_date: null,
    banner_url: null,
    status: "active",
  },
];

export const MOCK_SETTINGS: StoreSettings = {
  id: "16f960ef-38ac-49d2-8995-1553c679137e",
  store_name: "ยินดีหมูกรอบ",
  system_name: "Restaurant OS",
  tagline: "อร่อยทุกคำ อบอุ่นทุกจาน",
  logo_url: null,
  banner_url: null,
  hero_title: "ยินดีต้อนรับสู่ร้านยินดีหมูกรอบ",
  hero_subtitle: "สแกน สั่ง อร่อย ได้เลยที่โต๊ะของคุณ",
  primary_color: "#F97316",
  secondary_color: "#10B981",
  vat_rate: 7,
  service_charge_rate: 0,
  telegram_bot_token: "",
  telegram_chat_id: "",
  telegram_kitchen_chat_id: "",
  telegram_notify_enabled: true,
};

/* -------------------------------- helpers --------------------------------- */

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const result = await run();
    return result ?? fallback;
  } catch (error) {
    console.warn("API safe fallback used:", error);
    return fallback;
  }
}

export const baht = (value: number) =>
  `฿${Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const db = supabase as unknown as {
  from: (table: string) => any;
  channel: (name: string) => any;
  removeChannel: (channel: unknown) => void;
};

/* --------------------------------- queries -------------------------------- */

export const fetchCategories = () =>
  safe(async () => {
    const { data, error } = await db.from("categories").select("*").order("display_order");
    if (error) throw error;
    return ((data as Category[]) ?? []).map((cat) => {
      if (cat.name === "ของหวาน" || cat.code === "CAT_DESSERT") {
        return { ...cat, name: "เครื่องเคียง" };
      }
      return cat;
    });
  }, MOCK_CATEGORIES);

export const fetchMenu = () =>
  safe(async () => {
    const { data, error } = await db.from("menu_items").select("*").order("display_order");
    if (error) throw error;
    return (data as MenuItem[]) ?? [];
  }, MOCK_MENU);

export const fetchTables = () =>
  safe(async () => {
    const { data, error } = await db.from("tables").select("*").order("code");
    if (error) throw error;
    return (data as RestaurantTable[]) ?? [];
  }, MOCK_TABLES);

export const fetchPromotions = () =>
  safe(async () => {
    const { data, error } = await db.from("promotions").select("*").order("created_at");
    if (error) throw error;
    return (data as Promotion[]) ?? [];
  }, MOCK_PROMOTIONS);

export const fetchSettings = () =>
  safe(async () => {
    const { data, error } = await db.from("store_settings").select("*").limit(1).maybeSingle();
    if (error) throw error;
    const settings = (data as StoreSettings) ?? MOCK_SETTINGS;
    const local = getLocalTelegramConfig();
    return {
      ...settings,
      telegram_bot_token: settings.telegram_bot_token || local.botToken || "",
      telegram_chat_id: settings.telegram_chat_id || local.chatId || "",
      telegram_kitchen_chat_id: settings.telegram_kitchen_chat_id || local.kitchenChatId || "",
      telegram_notify_enabled: settings.telegram_notify_enabled ?? local.enabled ?? true,
    } as StoreSettings;
  }, MOCK_SETTINGS);

export const fetchOrders = () =>
  safe(async () => {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data as Order[]) ?? [];
  }, [] as Order[]);

/* -------------------------------- mutations ------------------------------- */

export type CartLine = {
  id?: string;
  item: MenuItem;
  qty: number;
  unitPrice?: number;
  summaryText?: string;
  note?: string;
  selectedPortion?: any;
  selectedSpice?: any;
  selectedAddOns?: any[];
};

export function makeOrderNumber() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `ORD-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function isDrinkCategory(category?: { name?: string | null; code?: string | null } | null): boolean {
  if (!category) return false;
  const code = (category.code || "").toUpperCase();
  const name = (category.name || "").toLowerCase();
  return (
    code === "CAT_DRINK" ||
    name.includes("เครื่องดื่ม") ||
    name.includes("drink") ||
    name.includes("beverage")
  );
}

export function isDrinkMenuItem(
  menuItem?: { id?: string | null; name?: string | null; category_id?: string | null } | null,
  categories?: Category[]
): boolean {
  if (!menuItem) return false;
  if (menuItem.category_id) {
    if (menuItem.category_id === "c4" || menuItem.category_id.toLowerCase().includes("drink")) return true;
    const cat = categories?.find((c) => c.id === menuItem.category_id);
    if (cat && isDrinkCategory(cat)) return true;
  }
  const name = (menuItem.name || "").toLowerCase();
  const drinkKeywords = [
    "เครื่องดื่ม", "น้ำเปล่า", "น้ำแข็ง", "น้ำดื่ม", "น้ำอัดลม", "น้ำผลไม้",
    "ชาเขียว", "ชามะนาว", "ชาไทย", "ชาดำ", "ชาเย็น", "ชาร้อน",
    "โค้ก", "coke", "pepsi", "เป๊ปซี่", "sprite", "สไปรท์", "แฟนต้า", "fanta",
    "กาแฟ", "โอเลี้ยง", "เก๊กฮวย", "ลำไย", "โอวัลติน", "ไมโล",
    "เบียร์", "beer", "โซดา", "soda", "นมสด", "สมูทตี้"
  ];
  return drinkKeywords.some((kw) => name.includes(kw));
}

export async function createOrder(input: {
  lines: CartLine[];
  tableId: string | null;
  orderType: OrderType;
  customerName: string;
  customerCount: number;
  discountAmount: number;
}) {
  const total = input.lines.reduce((s, l) => s + (l.unitPrice ?? l.item.price) * l.qty, 0);
  const final = Math.max(0, total - input.discountAmount);

  // ตรวจสอบหมวดหมู่เครื่องดื่ม: เครื่องดื่มไม่ต้องส่งเข้าครัว แต่คิดรวมในบิล
  let categories: Category[] = [];
  try {
    categories = await fetchCategories();
  } catch {
    categories = MOCK_CATEGORIES;
  }

  const foodLines = input.lines.filter((l) => !isDrinkMenuItem(l.item, categories));
  const hasFood = foodLines.length > 0;

  const payload = {
    order_number: makeOrderNumber(),
    table_id: input.tableId,
    order_type: input.orderType,
    customer_name: input.customerName,
    customer_count: input.customerCount,
    total_amount: total,
    discount_amount: input.discountAmount,
    final_amount: final,
    status: "in_kitchen" as OrderStatus,
  };

  const { data, error } = await db.from("orders").insert(payload).select().single();
  if (error) throw error;

  // บันทึกรายการทั้งหมดรวมถึงเครื่องดื่มลงใน order_items เพื่อให้คิดในบิล
  const items = input.lines.map((l) => {
    const unitPrice = l.unitPrice ?? l.item.price;
    return {
      order_id: (data as Order).id,
      menu_id: l.item.id,
      menu_name: l.summaryText ? `${l.item.name} (${l.summaryText})` : l.item.name,
      quantity: l.qty,
      unit_price: unitPrice,
      subtotal: unitPrice * l.qty,
    };
  });
  const { error: itemError } = await db.from("order_items").insert(items);
  if (itemError) throw itemError;

  // ส่งเข้าครัวเฉพาะเมื่อมีรายการอาหาร (เครื่องดื่มไม่ต้องส่งเข้าครัว)
  if (hasFood) {
    try {
      await db.from("kitchen_tickets").insert({
        order_id: (data as Order).id,
        station: "main",
        note: "",
        channel: "manual",
        status: "sent",
      });
    } catch (kErr) {
      console.warn("Could not create kitchen ticket automatically:", kErr);
    }
  }

  if (input.tableId) {
    await db.from("tables").update({ status: "occupied" }).eq("id", input.tableId);
  }
  return data as Order;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { error } = await db.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

/* -------------------------------- payments -------------------------------- */

export type PaymentMethod = "cash" | "transfer" | "card";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  transfer: "โอน / พร้อมเพย์",
  card: "บัตรเครดิต",
};

export type Payment = {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount_due: number;
  amount_received: number;
  change_amount: number;
  note: string;
  created_at: string;
};

/** ออเดอร์ที่ส่งแล้วและยังไม่ได้ชำระเงิน */
export const fetchUnpaidOrders = () =>
  safe(async () => {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .is("paid_at", null)
      .in("status", ["waiting", "in_kitchen", "served"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as Order[]) ?? [];
  }, [] as Order[]);

export async function payOrder(input: {
  order: Order;
  method: PaymentMethod;
  amountReceived: number;
  note?: string;
}) {
  const due = Number(input.order.final_amount || 0);
  const received = input.method === "cash" ? Number(input.amountReceived || 0) : due;
  if (received + 0.001 < due) throw new Error("รับเงินไม่พอ");

  const { data, error } = await db
    .from("payments")
    .insert({
      order_id: input.order.id,
      method: input.method,
      amount_due: due,
      amount_received: received,
      change_amount: Math.max(0, received - due),
      note: input.note ?? "",
    })
    .select()
    .single();
  if (error) throw error;

  const { error: orderError } = await db
    .from("orders")
    .update({
      status: "completed" as OrderStatus,
      paid_at: new Date().toISOString(),
      payment_method: input.method,
    })
    .eq("id", input.order.id);
  if (orderError) throw orderError;

  if (input.order.table_id) {
    await db.from("tables").update({ status: "available" }).eq("id", input.order.table_id);
  }
  return data as Payment;
}

/* ------------------------------ kitchen tickets ---------------------------- */

export type KitchenTicketStatus = "sent" | "received" | "cooking" | "done" | "cancelled";
export type KitchenChannel = "manual" | "api";

export const KITCHEN_STATUS_LABEL: Record<KitchenTicketStatus, string> = {
  sent: "ส่งครัวแล้ว",
  received: "ครัวรับแล้ว",
  cooking: "กำลังปรุง",
  done: "ปรุงเสร็จ",
  cancelled: "ยกเลิก",
};

export type KitchenTicket = {
  id: string;
  order_id: string;
  station: string;
  channel: KitchenChannel;
  status: KitchenTicketStatus;
  note: string;
  sent_at: string;
  received_at: string | null;
  done_at: string | null;
  created_at: string;
  orders?: Order | null;
};

/** ส่งออเดอร์เข้าครัวด้วยตนเอง (สร้างใบสั่งครัว + อัปเดตสถานะออเดอร์) */
export async function dispatchToKitchen(input: {
  orderId: string;
  station?: string;
  note?: string;
  channel?: KitchenChannel;
}) {
  const { data, error } = await db
    .from("kitchen_tickets")
    .insert({
      order_id: input.orderId,
      station: input.station ?? "main",
      note: input.note ?? "",
      channel: input.channel ?? "manual",
      status: "sent" as KitchenTicketStatus,
    })
    .select()
    .single();
  if (error) throw error;

  await db.from("orders").update({ status: "in_kitchen" as OrderStatus }).eq("id", input.orderId);
  return data as KitchenTicket;
}

export const fetchKitchenTickets = () =>
  safe(async () => {
    const { data, error } = await db
      .from("kitchen_tickets")
      .select("*, orders(*, order_items(*))")
      .order("sent_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data as KitchenTicket[]) ?? [];
  }, [] as KitchenTicket[]);

export async function setKitchenTicketStatus(id: string, status: KitchenTicketStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === "received") patch["received_at"] = new Date().toISOString();
  if (status === "done") patch["done_at"] = new Date().toISOString();
  const { error } = await db.from("kitchen_tickets").update(patch).eq("id", id);
  if (error) throw error;

  // When kitchen marks food as "done" (ready to serve), send Telegram notification!
  if (status === "done") {
    (async () => {
      try {
        const { data: ticket } = await db
          .from("kitchen_tickets")
          .select("*, orders(*, order_items(*))")
          .eq("id", id)
          .maybeSingle();

        if (ticket) {
          const order = (ticket as any)?.orders;
          let tableName = "";
          let zone = "";
          const isTakeaway = order?.order_type === "takeaway";

          if (order?.table_id) {
            try {
              const { data: table } = await db
                .from("tables")
                .select("code, name, zone")
                .eq("id", order.table_id)
                .maybeSingle();
              if (table) {
                tableName = table.name ? `${table.name} (${table.code})` : `โต๊ะ ${table.code}`;
                zone = table.zone || "";
              }
            } catch {
              // ignore table lookup error
            }
          }

          const items = (order?.order_items || []).map((it: any) => ({
            name: it.menu_name,
            quantity: it.quantity,
          }));

          await sendTelegramKitchenReadyAlert({
            ticketId: ticket.id,
            orderNumber: order?.order_number,
            tableName,
            tableCode: tableName ? undefined : "พร้อมเสิร์ฟ",
            zone,
            isTakeaway,
            items,
            note: ticket.note,
            station: ticket.station,
            createdAt: ticket.done_at || new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn("[setKitchenTicketStatus] Telegram ready alert failed:", err);
      }
    })();
  }
}

export async function generateWeeklySalesData(): Promise<{ success: boolean; orderCount: number; revenue: number }> {
  const { data: menuList, error: menuErr } = await db.from("menu_items").select("*");
  if (menuErr) throw menuErr;
  const { data: tablesList, error: tablesErr } = await db.from("tables").select("*");
  if (tablesErr) throw tablesErr;

  const menuByCode: Record<string, MenuItem> = {};
  (menuList || []).forEach((m: MenuItem) => {
    menuByCode[m.code] = m;
  });

  const tables = tablesList || [];

  // Delete previous test orders to replace with fresh 1-week data
  await db.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const today = new Date();
  const days: { dateStr: string; orderCount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const count = i === 0 ? 18 : i === 1 || i === 2 ? 28 + Math.floor(Math.random() * 5) : 20 + Math.floor(Math.random() * 5);
    days.push({ dateStr: `${yyyy}-${mm}-${dd}`, orderCount: count });
  }

  const popularDishes = [
    { code: "M001", name: "ข้าวหมูกรอบ", basePrice: 70, weight: 35 },
    { code: "M004", name: "ข้าวหมูแดงหมูกรอบ", basePrice: 70, weight: 28 },
    { code: "M009", name: "หมูกรอบจานใหญ่", basePrice: 180, weight: 16 },
    { code: "M003", name: "บะหมี่ต้มยำหมูกรอบ", basePrice: 60, weight: 20 },
    { code: "M005", name: "ผัดไทยหมูกรอบ", basePrice: 60, weight: 18 },
    { code: "M002", name: "ข้าวหมูแดง", basePrice: 60, weight: 15 },
    { code: "M008", name: "สุกี้แห้งหมูกรอบ", basePrice: 60, weight: 14 },
    { code: "M006", name: "บะหมี่เกี้ยวหมูกรอบ", basePrice: 60, weight: 12 },
    { code: "M007", name: "บะหมี่แห้งหมูกรอบ", basePrice: 60, weight: 10 },
    { code: "M0011", name: "หมูกรอบผสมหมูแดง", basePrice: 180, weight: 8 },
    { code: "M010", name: "หมูแดงจานใหญ่", basePrice: 80, weight: 6 },
  ];

  const drinksAndSides = [
    { code: "M012", name: "นํ้าโอเลี้ยง", basePrice: 15, weight: 25 },
    { code: "M014", name: "น้ำเปล่า", basePrice: 7, weight: 30 },
    { code: "M015", name: "โค้กกระป๋อง", basePrice: 16, weight: 18 },
    { code: "M016", name: "นํ้าโค้กขวด450มล.", basePrice: 17, weight: 15 },
    { code: "M021", name: "ไข่ต้มยางมะตูม", basePrice: 15, weight: 20 },
    { code: "M022", name: "ข้าวสวย", basePrice: 10, weight: 18 },
    { code: "M013", name: "ถังนํ้าแข็ง", basePrice: 20, weight: 12 },
    { code: "M018", name: "นํ้าส้มแฟนต้าขวด450มล", basePrice: 17, weight: 10 },
    { code: "M019", name: "อิชิตัน รสน้ำผึ้งผสมมะนาว 420 มล.", basePrice: 20, weight: 10 },
  ];

  function pickWeighted(list: typeof popularDishes) {
    const totalW = list.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * totalW;
    for (const item of list) {
      if (r < item.weight) return item;
      r -= item.weight;
    }
    return list[0];
  }

  const allOrders: any[] = [];
  const allOrderItems: any[] = [];

  for (let dIdx = 0; dIdx < days.length; dIdx++) {
    const day = days[dIdx];
    const isToday = dIdx === days.length - 1;

    for (let i = 0; i < day.orderCount; i++) {
      const orderId = crypto.randomUUID();
      const isDineIn = Math.random() < 0.62;
      const isCancelled = Math.random() < 0.04;

      let hourThai: number;
      const slotR = Math.random();
      if (isToday) {
        hourThai = 10 + Math.floor(Math.random() * 4);
      } else if (slotR < 0.55) {
        hourThai = 11 + Math.floor(Math.random() * 3);
      } else if (slotR < 0.70) {
        hourThai = 14 + Math.floor(Math.random() * 3);
      } else {
        hourThai = 17 + Math.floor(Math.random() * 4);
      }

      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);

      const hourUTC = hourThai - 7;
      const p = (n: number) => String(n).padStart(2, "0");
      const createdAtISO = `${day.dateStr}T${p(hourUTC)}:${p(minute)}:${p(second)}.000Z`;
      const orderNo = `ORD-26${day.dateStr.slice(5, 7)}${day.dateStr.slice(8, 10)}${p(hourThai)}${p(minute)}${p(second)}`;

      const table = isDineIn && tables.length > 0 ? tables[Math.floor(Math.random() * tables.length)] : null;
      const custCount = isDineIn ? Math.floor(Math.random() * 3) + 1 : 1;

      let customerName: string;
      if (isDineIn) {
        const custNames = ["คุณสมชาย", "คุณกิตติ", "คุณสุชาติ", "คุณวรรณา", "คุณนภา", "คุณธีรพงศ์", "คุณปิยะ", "คุณอรทัย"];
        customerName = Math.random() < 0.4 ? custNames[Math.floor(Math.random() * custNames.length)] : `ลูกค้า ${table ? table.name : "โต๊ะ 1"}`;
      } else {
        const togoNames = ["สั่งกลับบ้าน (คุณแอน)", "สั่งกลับบ้าน (คุณเอก)", "สั่งกลับบ้าน (Lineman)", "สั่งกลับบ้าน (Grab)", "สั่งกลับบ้าน", "สั่งกลับบ้าน (คุณบอย)"];
        customerName = togoNames[Math.floor(Math.random() * togoNames.length)];
      }

      const itemCount = Math.min(custCount + (Math.random() < 0.6 ? 1 : 0), 4);
      const chosenItems: any[] = [];
      chosenItems.push(pickWeighted(popularDishes));

      if (itemCount >= 2) {
        chosenItems.push(Math.random() < 0.5 ? pickWeighted(popularDishes) : pickWeighted(drinksAndSides));
      }
      if (itemCount >= 3) chosenItems.push(pickWeighted(drinksAndSides));
      if (itemCount >= 4) chosenItems.push(pickWeighted(drinksAndSides));

      let orderTotal = 0;
      const orderItems: any[] = [];

      for (const itemDef of chosenItems) {
        const menuItem = menuByCode[itemDef.code] || { id: crypto.randomUUID(), price: itemDef.basePrice, name: itemDef.name };
        const qty = Math.random() < 0.85 ? 1 : 2;

        let itemName = itemDef.name;
        let unitPrice = Number(menuItem.price) || itemDef.basePrice;

        if (itemDef.code === "M001" || itemDef.code === "M002" || itemDef.code === "M004") {
          const optR = Math.random();
          if (optR < 0.35) {
            itemName = `${itemDef.name} (พิเศษ)`;
            unitPrice += 10;
          } else if (optR < 0.55) {
            itemName = `${itemDef.name} (พิเศษ | เพิ่ม: ไข่ต้มยางมะตูม)`;
            unitPrice += 25;
          } else if (optR < 0.70) {
            itemName = `${itemDef.name} (ธรรมดา | เพิ่ม: ไข่ต้มยางมะตูม)`;
            unitPrice += 15;
          } else {
            itemName = `${itemDef.name} (ธรรมดา)`;
          }
        } else if (itemDef.code === "M005" || itemDef.code === "M008") {
          const spice = Math.random() < 0.5 ? "เผ็ดปกติ" : (Math.random() < 0.5 ? "ไม่เผ็ด" : "เผ็ดมาก");
          itemName = `${itemDef.name} (ธรรมดา | เผ็ด: ${spice})`;
        } else if (itemDef.code === "M009" || itemDef.code === "M0011") {
          if (Math.random() < 0.4) {
            itemName = `${itemDef.name} (เพิ่ม: ข้าวสวย)`;
            unitPrice += 10;
          }
        }

        const subtotal = unitPrice * qty;
        orderTotal += subtotal;

        orderItems.push({
          id: crypto.randomUUID(),
          order_id: orderId,
          menu_id: menuItem.id,
          menu_name: itemName,
          quantity: qty,
          unit_price: unitPrice,
          subtotal: subtotal,
          created_at: createdAtISO,
        });
      }

      const status = isCancelled ? "cancelled" : "completed";
      const paidAt = isCancelled ? null : createdAtISO;
      const paymentMethod = isCancelled ? null : (Math.random() < 0.65 ? "transfer" : "cash");

      allOrders.push({
        id: orderId,
        order_number: orderNo,
        table_id: table ? table.id : null,
        order_type: isDineIn ? "dine_in" : "takeaway",
        customer_name: customerName,
        customer_count: custCount,
        total_amount: orderTotal,
        discount_amount: 0,
        final_amount: orderTotal,
        status,
        created_at: createdAtISO,
        updated_at: createdAtISO,
        paid_at: paidAt,
        payment_method: paymentMethod,
      });

      allOrderItems.push(...orderItems);
    }
  }

  for (let i = 0; i < allOrders.length; i += 50) {
    const chunk = allOrders.slice(i, i + 50);
    const { error } = await db.from("orders").insert(chunk);
    if (error) throw error;
  }

  for (let i = 0; i < allOrderItems.length; i += 100) {
    const chunk = allOrderItems.slice(i, i + 100);
    const { error } = await db.from("order_items").insert(chunk);
    if (error) throw error;
  }

  const paidOrders = allOrders.filter((o) => o.status === "completed");
  const totalRev = paidOrders.reduce((s, o) => s + o.final_amount, 0);

  return { success: true, orderCount: allOrders.length, revenue: totalRev };
}

/* ----------------------------- service calls ------------------------------ */

// Persistent channel for instant broadcasting of staff alerts
const alertChannels: Record<string, any> = {};
function getAlertBroadcastChannel(name = "staff-serving-live") {
  if (!alertChannels[name]) {
    alertChannels[name] = db.channel(name, {
      config: { broadcast: { self: false } },
    });
    alertChannels[name].subscribe();
  }
  return alertChannels[name];
}

export const fetchServiceCalls = () =>
  safe(async () => {
    // fetch all unresolved calls from the last 24 hours to prevent timezone issues
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db
      .from("service_calls")
      .select("*")
      .eq("resolved", false)
      .gte("created_at", since)
      .order("created_at");
    if (error) throw error;
    return (data as ServiceCall[]) ?? [];
  }, []);

export async function createServiceCall(tableId: string, message = "เรียกพนักงาน", tableCode?: string) {
  let resolvedTableId = tableId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId || "");

  if (!isUuid) {
    // If tableId is not a valid UUID (e.g. "t1", "T01", "1"), look up the actual UUID in tables
    try {
      const searchTerms = [tableCode, tableId].filter(Boolean) as string[];
      for (const term of searchTerms) {
        const norm = term.trim().toUpperCase();
        const digits = norm.replace(/\D/g, "");
        const paddedCode = digits ? `T${digits.padStart(2, "0")}` : norm;

        const { data } = await db
          .from("tables")
          .select("id, code")
          .or(`code.ilike.${norm},code.ilike.${paddedCode}`)
          .limit(1)
          .maybeSingle();

        if (data?.id) {
          resolvedTableId = data.id;
          if (!tableCode) tableCode = data.code;
          break;
        }
      }
    } catch (lookupErr) {
      console.warn("[createServiceCall] Could not resolve table UUID:", lookupErr);
    }
  }

  const { data, error } = await db
    .from("service_calls")
    .insert({ table_id: resolvedTableId, message })
    .select()
    .single();
  if (error) {
    console.error("[createServiceCall] Insert failed:", error, { tableId, resolvedTableId, message });
    throw error;
  }

  const payload = {
    new: {
      id: data?.id || String(Date.now()),
      table_id: resolvedTableId,
      table_code: tableCode,
      message,
      created_at: data?.created_at || new Date().toISOString(),
    },
  };

  // Broadcast to all staff channels for immediate delivery
  const targetChannels = ["staff-serving-live", "all-in-one-live"];
  for (const chName of targetChannels) {
    try {
      const channel = getAlertBroadcastChannel(chName);
      channel.send({
        type: "broadcast",
        event: "service_call_alert",
        payload,
      }).catch((err: any) => {
        console.warn(`broadcast ${chName} error:`, err);
      });
    } catch (e) {
      console.warn(`broadcast ${chName} init error:`, e);
    }
  }

  // Dispatch real-time Telegram notification
  (async () => {
    try {
      let resolvedTableName = tableCode ? `โต๊ะ ${tableCode}` : "";
      let resolvedZone = "";

      if (resolvedTableId) {
        try {
          const { data: tableData } = await db
            .from("tables")
            .select("code, name, zone")
            .eq("id", resolvedTableId)
            .maybeSingle();
          if (tableData) {
            resolvedTableName = tableData.name ? `${tableData.name} (${tableData.code})` : `โต๊ะ ${tableData.code}`;
            resolvedZone = tableData.zone || "";
          }
        } catch {
          // ignore table detail lookup error
        }
      }

      await sendTelegramServiceAlert({
        tableId: resolvedTableId,
        tableCode: tableCode,
        tableName: resolvedTableName,
        zone: resolvedZone,
        message,
        callId: data?.id,
        createdAt: data?.created_at,
      });
    } catch (telegramErr) {
      console.warn("[createServiceCall] Telegram notification failed:", telegramErr);
    }
  })();

  return data;
}

export async function resolveServiceCall(id: string) {
  const { error } = await db
    .from("service_calls")
    .update({ resolved: true })
    .eq("id", id);
  if (error) throw error;
}

/* ----------------------------- staff management --------------------------- */

export const fetchStaffUsers = () =>
  safe(async () => {
    let result: StaffUser[] = [];
    try {
      const { data, error } = await db.from("staff_users").select("*").order("created_at");
      if (!error && data) {
        result = [...(data as StaffUser[])];
      }
    } catch (e) {
      console.warn("fetch staff_users error:", e);
    }

    // Also merge from staff_members if any are not present
    try {
      const { data: members, error: memError } = await db
        .from("staff_members")
        .select("*")
        .order("created_at");
      if (!memError && members && members.length > 0) {
        members.forEach((m) => {
          if (!result.some((u) => u.name.toLowerCase() === m.name.toLowerCase())) {
            result.push({
              id: m.id,
              name: m.name,
              username:
                m.role === "admin"
                  ? "admin"
                  : m.role === "cashier"
                  ? "cashier1"
                  : m.role === "kitchen"
                  ? "kitchen"
                  : "staff1",
              password: null,
              pin: null,
              role_id: m.role,
              is_active: m.is_active ?? true,
              created_at: m.created_at || new Date().toISOString(),
            });
          }
        });
      }
    } catch (memErr) {
      console.warn("fetch staff_members error:", memErr);
    }

    // Apply any local persistent overrides so user edits are NEVER lost
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("pos_local_staff_cache");
        if (raw) {
          const overrides: Record<string, Partial<StaffUser>> = JSON.parse(raw);
          result = result.map((s) => {
            if (overrides[s.id]) {
              return { ...s, ...overrides[s.id] };
            }
            return s;
          });
          // Also include any locally created staff
          Object.values(overrides).forEach((item) => {
            if (item.id && !result.some((r) => r.id === item.id)) {
              result.push(item as StaffUser);
            }
          });
        }
      }
    } catch (cacheErr) {
      console.warn("apply local staff cache error:", cacheErr);
    }

    // Filter out deleted staff
    try {
      if (typeof window !== "undefined") {
        const rawDel = localStorage.getItem("pos_deleted_staff_ids");
        if (rawDel) {
          const deletedList: string[] = JSON.parse(rawDel);
          result = result.filter(
            (s) => !deletedList.includes(s.id) && !deletedList.includes(s.name.toLowerCase())
          );
        }
      }
    } catch (dErr) {
      console.warn("apply deleted staff filter error:", dErr);
    }

    return result;
  }, []);

export async function createStaffUser(input: Omit<StaffUser, "id" | "created_at">) {
  const { error } = await db.from("staff_users").insert(input);
  if (error) throw error;
}

export async function updateStaffUser(id: string, input: Partial<Omit<StaffUser, "id" | "created_at">>) {
  const { error } = await db.from("staff_users").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteStaffUser(id: string, name?: string) {
  // 1. Delete from Supabase staff_users
  try {
    await db.from("staff_users").delete().eq("id", id);
  } catch (e) {
    console.warn("delete staff_users error:", e);
  }

  // 2. Delete from Supabase staff_members
  try {
    if (name) {
      await db.from("staff_members").delete().or(`id.eq.${id},name.ilike.${name}`);
    } else {
      await db.from("staff_members").delete().eq("id", id);
    }
  } catch (e) {
    console.warn("delete staff_members error:", e);
  }

  // 3. Update local cache and deleted IDs list
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("pos_local_staff_cache");
      if (raw) {
        const cache = JSON.parse(raw);
        delete cache[id];
        localStorage.setItem("pos_local_staff_cache", JSON.stringify(cache));
      }

      const rawDel = localStorage.getItem("pos_deleted_staff_ids");
      const list: string[] = rawDel ? JSON.parse(rawDel) : [];
      if (!list.includes(id)) list.push(id);
      if (name && !list.includes(name.toLowerCase())) list.push(name.toLowerCase());
      localStorage.setItem("pos_deleted_staff_ids", JSON.stringify(list));
    } catch (err) {
      console.warn("delete local cache error:", err);
    }
  }
}

