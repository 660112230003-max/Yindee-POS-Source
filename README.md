# Harmony POS

[cite_start]Create a comprehensive, production-ready Full-Stack Restaurant Operating System (Restaurant OS) application built with React, Tailwind CSS, Lucide Icons, and Supabase integration. [cite: 1, 23, 46] The system features a dual-mode interface:

1. [cite_start]Customer Self-Ordering Web App (QR Code Scan View at `/table/:tableId`) [cite: 46, 50]

2. [cite_start]Staff & Admin Management Console (POS, Kitchen, Table, Promotion, and Store Settings) [cite: 8, 28, 46]

---

### 🎨 1. Design & UI/UX Guidelines

- [cite_start]**Layout Architecture**: Modern Bento Grid layout featuring smooth rounded cards (`rounded-2xl`), subtle borders, modern elevated shadows, and dynamic micro-interactions[cite: 2, 3, 26, 47].

- **Color Palette**:

  - [cite_start]Primary / Accent: Crimson Red (`#E53E3E` / `#DC2626`) and Emerald Green (`#10B981`)[cite: 4].

  - [cite_start]Dark Accent / Customer Header: Deep Dark Red (`#8B1E1E`)[cite: 50].

  - [cite_start]Sidebar: Dark Slate (`#0F172A`) with active state highlights[cite: 5].

  - [cite_start]Background: Very light clean gray (`#F8FAFC`) with support for dark ambient wooden atmosphere on customer views[cite: 5, 50].

- [cite_start]**Typography & Localization**: Clean sans-serif typography with full support for seamless Thai and English text rendering[cite: 6, 24, 48].

---

### 🗄️ 2. Supabase Database Schema & Logic

[cite_start]Generate complete SQL schema scripts and client setup for Supabase with automatic local mock fallback data whenever Supabase is disconnected[cite: 7, 22, 25, 45, 48]:

1. [cite_start]`categories`: `id` (uuid, primary key), `name` (text), `code` (text, e.g., 'CAT_RICE'), `display_order` (int), `created_at` (timestamp). [cite: 25, 48]

2. [cite_start]`menu_items`: `id` (uuid, primary key), `code` (text, e.g., 'M001'), `name` (text), `category_id` (foreign key), `price` (numeric), `description` (text), `image_url` (text), `is_popular` (boolean), `display_order` (int), `status` (enum: 'available', 'out_of_stock'). [cite: 25, 48]

3. [cite_start]`tables`: `id` (uuid, primary key), `code` (text, e.g., 'T01'-'T13'), `name` (text), `zone` (enum: 'indoor', 'terrace'), `status` (enum: 'available', 'occupied', 'disabled'), `qr_code_url` (text). [cite: 25, 48]

4. [cite_start]`promotions`: `id` (uuid, primary key), `title` (text), `code` (text), `description` (text), `discount_type` (enum: 'percentage', 'fixed_amount'), `discount_value` (numeric), `min_spend` (numeric), `start_date` (date), `end_date` (date), `banner_url` (text), `status` (enum: 'active', 'inactive'). [cite: 25, 48]

5. [cite_start]`orders`: `id` (uuid, primary key), `order_number` (text, e.g., 'ORD-260829131043'), `table_id` (foreign key), `order_type` (enum: 'dine_in', 'takeaway'), `customer_name` (text), `customer_count` (int), `total_amount` (numeric), `discount_amount` (numeric), `final_amount` (numeric), `status` (enum: 'waiting', 'in_kitchen', 'served', 'completed', 'cancelled'), `created_at` (timestamp). [cite: 25, 48]

6. [cite_start]`order_items`: `id` (uuid, primary key), `order_id` (foreign key), `menu_id` (foreign key), `quantity` (int), `unit_price` (numeric), `subtotal` (numeric). [cite: 25, 48, 49]

7. [cite_start]`store_settings`: `id` (uuid, primary key), `store_name` (text), `system_name` (text), `tagline` (text), `logo_url` (text), `banner_url` (text), `hero_title` (text), `hero_subtitle` (text), `primary_color` (text), `secondary_color` (text), `vat_rate` (numeric), `service_charge_rate` (numeric). [cite: 26, 49]

---

### 📲 3. Customer QR Scan Menu App View (`/table/:tableId`)

- [cite_start]**Header & Atmosphere**: Dark wooden container styling with a prominent Dark Red banner (`#8B1E1E`) displaying dynamic Store Name, Live Date/Time, and Table Welcome Banner (e.g., "ยินดีต้อนรับ โต๊ะ T5")[cite: 50].

- [cite_start]**Category Filter Pills**: Horizontal scroll filter buttons ("เมนูอาหาร", "🔥 ยอดนิยม", "อาหารจานเดียว", "กับข้าว", "เครื่องดื่ม", "ของหวาน")[cite: 51].

- [cite_start]**Bento Menu Grid**: Food cards with images, code, name, description, price (฿), status badges ("หมด" badge when out of stock), and item quantity counter (`-`, `0`, `+` / "เพิ่ม")[cite: 52].

- **Floating Quick Actions (Bottom-Left)**:

  - [cite_start]🔔 "แจ้งพนักงาน" (Call Waiter) modal trigger[cite: 53].

  - [cite_start]📞 "เรียกเช็คบิล" (Request Bill) action trigger[cite: 53].

- **Slide-in Cart Drawer (Bottom-Right)**:

  - [cite_start]Item list breakdown, quantity controls, quick discount pills (`10% OFF`, `20% OFF`), price summary (Subtotal, Discount, Final Total), and a prominent red button "ยืนยันคำสั่งซื้อ" (Confirm Order)[cite: 31, 53, 54, 55, 56].

---

### 🖥️ 4. Staff & Admin Navigation & Modules

#### A. Fixed Sidebar Navigation (Left Panel)

- [cite_start]Header: Brand logo and title "Restaurant OS / Admin Console"[cite: 7, 27].

- Navigation Items:

  - [cite_start]🛒 **Order** (หน้ารับออเดอร์/แคชเชียร์) [cite: 8, 28]

  - [cite_start]📋 **Order Status** (สถานะคำสั่งซื้อ & ห้องครัว) [cite: 8, 28]

  - [cite_start]🪑 **โต๊ะและ QR** (Table & QR Management) [cite: 28]

  - [cite_start]🍱 **เมนูอาหาร** (Menu & Category Management) [cite: 28]

  - [cite_start]🏷️ **โปรโมชั่น** (Promotions & Coupons) [cite: 28]

  - [cite_start]⚙️ **ตั้งค่าร้าน** (Store Branding & Config) [cite: 28]

  - [cite_start]🛡️ **Admin Panel** (Dashboard ผู้บริหาร - PIN Protected) [cite: 8, 28]

- [cite_start]Bottom Bar: User profile & Logout button[cite: 8, 28].

#### B. Order & POS Page

- [cite_start]Top Bar: Menu search input, Customer Name field, Diner Count, and Table Selection dropdown (T01-T13, Take Away)[cite: 9, 30, 56].

- [cite_start]Menu Bento Grid with stock badges and instant add-to-cart controls[cite: 10, 28, 29, 57].

- [cite_start]Right Cart Panel: Order list, preset discount buttons (No Discount, 10%, Birthday 15%, Promo 20%), tax/discount calculations, and "ยืนยันคำสั่งซื้อ" (Confirm Order) button[cite: 11, 12, 13, 31, 57].

#### C. Order Status & Kitchen Workflow

- [cite_start]Live Realtime Bento Order Cards showing Order Code (e.g., `ORD-260829131043`), Order Type tag (Dine-in / Takeaway), item list with quantities, and current status[cite: 14, 32, 58].

- [cite_start]Card Action Buttons: 🖨️ พิมพ์ส่งครัว (Kitchen), 🔔 เสิร์ฟแล้ว (Mark Served), 🗑️ ยกเลิก (Cancel Order)[cite: 15, 33, 59].

- [cite_start]Top Filters: Date picker, "Show Paid Orders" toggle, and manual Refresh button[cite: 13, 34].

#### D. Menu Management Module

- [cite_start]Category display order editor[cite: 35].

- [cite_start]Menu table with interactive status toggles ('ใช้งาน' / 'หมด')[cite: 36, 60].

- [cite_start]**Add/Edit Menu Modal**: Input fields for Item Name, Category, Price, Display Order, Description, Image URL, client-side File Uploader with auto-resize/compression (< 7MB), Status selector, and "เมนูยอดนิยม" (Popular Item) checkbox[cite: 37, 61].

#### E. Table & QR Management Module

- [cite_start]Responsive list of tables (T01-T13) displaying Zone badges (โซนด้านใน, โซนระเบียง), Status badges (ว่าง, มีลูกค้า, Disabled), "ดู QR" modal toggle, and Edit Table details[cite: 21, 38, 62].

#### F. Promotion Engine Module

- [cite_start]Promotion cards/table listing active campaigns, discount values (percentage/fixed), date ranges, and status toggles[cite: 39, 63].

- [cite_start]**Add/Edit Promotion Modal**: Code generator, title, description, discount calculation settings, min spend threshold, date range pickers, and banner URL upload[cite: 40, 64].

#### G. Store Settings & Theme Config

- [cite_start]Form controls for Store Identity (Name, System Name, Tagline, Logo/Banner URLs), Custom Theme Color pickers (Primary Red, Secondary Emerald), Customer Hero Banner settings, and Financial Operations (VAT %, Service Charge %)[cite: 41, 65].

#### H. Protected Admin Dashboard

- [cite_start]**Security Lock**: Password / PIN prompt screen before entering sensitive dashboard data[cite: 15, 42, 65].

- [cite_start]**Bento Metric Cards**: Total Revenue (Red Accent card), Total Orders (Blue Accent card), Active Menu Items (Green Accent card) with trend indicators[cite: 17, 18, 43, 65].

- [cite_start]**Best Sellers Table**: Rank, Item Name, Units Sold, and Total Revenue[cite: 19, 44, 66].

- [cite_start]**Sales Analytics Report**: Revenue breakdown comparison by order type (Dine-In vs. Takeaway)[cite: 20, 44].

---

### ⚙️ 5. Technical Requirements

- [cite_start]Use **Tailwind CSS** with custom configuration for Bento Grid shadows and rounded corners (`rounded-2xl`)[cite: 1, 3, 26].

- [cite_start]Integrate **Lucide Icons** across all navigation links, buttons, and status badges[cite: 1, 23, 46].

- [cite_start]Implement full **Supabase CRUD operations** with `onSnapshot` / Realtime subscriptions for orders[cite: 25, 45, 48].

- [cite_start]Provide **Toast notifications** for all state changes (e.g., item added, order confirmed, kitchen printed, status updated)[cite: 45].

- [cite_start]Include comprehensive **Mock Data Fallback System** to ensure seamless presentation even if Supabase backend is disconnected[cite: 22, 45].
uiแบบในภาพ

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/38896162-f5c3-4f36-bffb-823705cf8d09).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
