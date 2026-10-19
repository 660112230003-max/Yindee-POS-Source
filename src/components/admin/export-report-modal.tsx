import React, { useState, useMemo, useCallback } from "react";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Order, RestaurantTable, baht } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

interface ExportReportModalProps {
  orders: Order[];
  tables?: RestaurantTable[];
  storeName?: string;
}

type DateRangeType = "today" | "7days" | "this_month" | "all" | "custom";

// ─── Calendar helpers ────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(d: Date) {
  return d.toISOString().split("T")[0] ?? "";
}
function startOfDayFromStr(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

const MONTH_NAMES_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const DAY_NAMES_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];

// ─── Inline Calendar Component ────────────────────────────────────────────────

interface CalendarPickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

function CalendarPicker({ startDate, endDate, onStartChange, onEndChange }: CalendarPickerProps) {
  const today = toDateStr(new Date());
  const initYear = startDate ? parseInt(startDate.slice(0, 4)) : new Date().getFullYear();
  const initMonth = startDate ? parseInt(startDate.slice(5, 7)) - 1 : new Date().getMonth();

  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [hovered, setHovered] = useState<string | null>(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const handleDayClick = useCallback((dateStr: string) => {
    if (phase === "start") {
      onStartChange(dateStr);
      if (endDate && dateStr > endDate) onEndChange(dateStr);
      setPhase("end");
    } else {
      if (dateStr < startDate) {
        onStartChange(dateStr);
        setPhase("end");
      } else {
        onEndChange(dateStr);
        setPhase("start");
      }
    }
  }, [phase, startDate, endDate, onStartChange, onEndChange]);

  const effectiveEnd = phase === "end" && hovered ? hovered : endDate;

  const isInRange = (dateStr: string) => {
    if (!startDate || !effectiveEnd) return false;
    const [lo, hi] = startDate <= effectiveEnd ? [startDate, effectiveEnd] : [effectiveEnd, startDate];
    return dateStr > lo && dateStr < hi;
  };

  const isStart = (dateStr: string) => dateStr === startDate;
  const isEnd = (dateStr: string) => dateStr === effectiveEnd;

  const cells: Array<{ dateStr: string } | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    cells.push({ dateStr: `${viewYear}-${m}-${day}` });
  }

  const thaiYear = viewYear + 543;

  return (
    <div className="select-none rounded-xl border border-border bg-card shadow-md p-3 space-y-2">
      {/* Phase indicator tabs */}
      <div className="flex items-center gap-2 text-[11px] font-semibold mb-1">
        <button
          type="button"
          onClick={() => setPhase("start")}
          className={cn(
            "flex-1 rounded-md py-1.5 px-2 text-center border transition-all",
            phase === "start"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
          )}
        >
          📅 วันเริ่มต้น
          <span className="block font-normal text-[10px] mt-0.5">
            {startDate ? startOfDayFromStr(startDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "— เลือกวันที่ —"}
          </span>
        </button>
        <span className="text-muted-foreground shrink-0">→</span>
        <button
          type="button"
          onClick={() => setPhase("end")}
          className={cn(
            "flex-1 rounded-md py-1.5 px-2 text-center border transition-all",
            phase === "end"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
          )}
        >
          📅 วันสิ้นสุด
          <span className="block font-normal text-[10px] mt-0.5">
            {endDate ? startOfDayFromStr(endDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "— เลือกวันที่ —"}
          </span>
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={prevMonth} className="p-1 rounded-md hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-xs font-bold text-foreground">
          {MONTH_NAMES_TH[viewMonth]} {thaiYear}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded-md hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} />;
          const { dateStr } = cell;
          const start = isStart(dateStr);
          const end = isEnd(dateStr) && dateStr !== startDate;
          const inRange = isInRange(dateStr);
          const isToday = dateStr === today;
          const isFuture = dateStr > today;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isFuture}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => setHovered(dateStr)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "relative h-8 w-full text-[12px] font-medium transition-all",
                isFuture && "opacity-25 cursor-not-allowed rounded-md",
                !isFuture && !start && !end && !inRange && "hover:bg-primary/15 text-foreground rounded-md",
                inRange && "bg-primary/15 text-primary rounded-none",
                isToday && !start && !end && "ring-1 ring-inset ring-primary/40 text-primary font-bold rounded-md",
                start && "bg-primary text-primary-foreground font-bold shadow-sm z-10 rounded-l-md",
                end && "bg-primary text-primary-foreground font-bold shadow-sm z-10 rounded-r-md",
                start && !end && endDate && startDate !== endDate && "rounded-r-none",
                end && !start && startDate && startDate !== endDate && "rounded-l-none",
                start && end && "rounded-md",
              )}
            >
              {parseInt(dateStr.slice(8))}
              {isToday && !start && !end && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick shortcuts */}
      <div className="border-t border-border/60 pt-2 grid grid-cols-3 gap-1.5">
        {[
          { label: "สัปดาห์นี้", days: 7 },
          { label: "14 วัน", days: 14 },
          { label: "30 วัน", days: 30 },
        ].map(({ label, days }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              const end = new Date();
              const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
              onStartChange(toDateStr(start));
              onEndChange(toDateStr(end));
              setPhase("start");
            }}
            className="text-[10px] font-semibold rounded-md border border-border bg-muted/40 py-1 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-muted-foreground"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExportReportModal({
  orders,
  tables = [],
  storeName = "ยินดีหมูกรอบ",
}: ExportReportModalProps) {
  const [open, setOpen] = useState(false);
  const [rangeType, setRangeType] = useState<DateRangeType>("7days");
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // Custom date range state (YYYY-MM-DD)
  const [startDate, setStartDate] = useState(() => toDateStr(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(() => toDateStr(new Date()));

  // Table lookup map
  const tableMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((t) => map.set(t.id, t.name || t.code));
    return map;
  }, [tables]);

  // Compute date bounds based on rangeType
  const { fromTime, toTime, rangeLabel } = useMemo(() => {
    const now = new Date();
    let from = new Date(0);
    let to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let label = "";

    if (rangeType === "today") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      label = `ประจำวันที่ ${now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}`;
    } else if (rangeType === "7days") {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6);
      past7.setHours(0, 0, 0, 0);
      from = past7;
      label = `ย้อนหลัง 7 วัน (${past7.toLocaleDateString("th-TH")} - ${now.toLocaleDateString("th-TH")})`;
    } else if (rangeType === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      label = `ประจำเดือน ${now.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}`;
    } else if (rangeType === "custom") {
      from = new Date(`${startDate}T00:00:00`);
      to = new Date(`${endDate}T23:59:59.999`);
      const fromLocal = from.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
      const toLocal = to.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
      label = `กำหนดเอง: ${fromLocal} – ${toLocal}`;
    } else {
      label = "ข้อมูลทั้งหมดตลอดอายุการใช้งาน";
    }

    return { fromTime: from.getTime(), toTime: to.getTime(), rangeLabel: label };
  }, [rangeType, startDate, endDate]);

  // Filter orders according to selection
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      if (rangeType !== "all" && (t < fromTime || t > toTime)) return false;
      if (!includeCancelled && o.status === "cancelled") return false;
      return true;
    });
  }, [orders, rangeType, fromTime, toTime, includeCancelled]);

  // Calculate stats
  const stats = useMemo(() => {
    const completedOrders = filteredOrders.filter((o) => o.status !== "cancelled");
    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.final_amount || 0), 0);
    const dineInRevenue = completedOrders
      .filter((o) => o.order_type === "dine_in")
      .reduce((sum, o) => sum + Number(o.final_amount || 0), 0);
    const takeawayRevenue = totalRevenue - dineInRevenue;
    const totalDiscount = completedOrders.reduce(
      (sum, o) => sum + Number(o.discount_amount || 0),
      0,
    );
    const cancelledCount = filteredOrders.filter((o) => o.status === "cancelled").length;

    // Item ranking
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    completedOrders.forEach((o) => {
      (o.order_items || []).forEach((it) => {
        const baseName = (it.menu_name || "").split("(")[0]?.trim() || it.menu_name || "ไม่ระบุ";
        const prev = itemMap.get(baseName) ?? { name: baseName, qty: 0, revenue: 0 };
        itemMap.set(baseName, {
          name: baseName,
          qty: prev.qty + it.quantity,
          revenue: prev.revenue + Number(it.subtotal || 0),
        });
      });
    });

    const bestSellers = [...itemMap.values()].sort((a, b) => b.qty - a.qty);

    return {
      totalRevenue,
      dineInRevenue,
      takeawayRevenue,
      totalDiscount,
      totalCount: filteredOrders.length,
      paidCount: completedOrders.length,
      cancelledCount,
      bestSellers,
    };
  }, [filteredOrders]);

  // Export to CSV Function
  const handleExportCSV = () => {
    const rows: string[][] = [];

    // Header & Info
    rows.push([`รายงานยอดขายร้าน ${storeName}`]);
    rows.push([`ช่วงเวลา:`, rangeLabel]);
    rows.push([`วันที่พิมพ์รายงาน:`, new Date().toLocaleString("th-TH")]);
    rows.push([`เงื่อนไข:`, includeCancelled ? "รวมบิลที่ยกเลิก" : "เฉพาะบิลที่สำเร็จ"]);
    rows.push([]);

    // Summary Section
    rows.push(["=== สรุปยอดขายภาพรวม ==="]);
    rows.push(["ยอดขายสุทธิรวม (บาท)", stats.totalRevenue.toFixed(2)]);
    rows.push(["ยอดขายทานที่ร้าน (บาท)", stats.dineInRevenue.toFixed(2)]);
    rows.push(["ยอดขายสั่งกลับบ้าน (บาท)", stats.takeawayRevenue.toFixed(2)]);
    rows.push(["ส่วนลดทั้งหมด (บาท)", stats.totalDiscount.toFixed(2)]);
    rows.push(["จำนวนออเดอร์ที่ชำระเงิน (บิล)", String(stats.paidCount)]);
    rows.push(["จำนวนออเดอร์ที่ยกเลิก (บิล)", String(stats.cancelledCount)]);
    rows.push([]);

    // Top Selling Items Section
    rows.push(["=== สรุปยอดขายตามเมนู (อันดับความนิยม) ==="]);
    rows.push(["อันดับ", "ชื่อเมนู", "จำนวนจาน/แก้ว", "ยอดขายรวม (บาท)", "สัดส่วน %"]);
    stats.bestSellers.forEach((item, index) => {
      const pct = stats.totalRevenue > 0 ? ((item.revenue / stats.totalRevenue) * 100).toFixed(1) : "0.0";
      rows.push([
        String(index + 1),
        item.name,
        String(item.qty),
        item.revenue.toFixed(2),
        `${pct}%`,
      ]);
    });
    rows.push([]);

    // Order Details Section
    rows.push(["=== รายละเอียดบิลคำสั่งซื้อทั้งหมด ==="]);
    rows.push([
      "ลำดับ",
      "เลขที่บิล (Order No.)",
      "วันที่-เวลา",
      "ประเภท",
      "โต๊ะ/ช่องทาง",
      "ลูกค้า",
      "ยอดรวม (บาท)",
      "ส่วนลด (บาท)",
      "ยอดสุทธิ (บาท)",
      "สถานะ",
      "รายการอาหารที่สั่ง",
    ]);

    filteredOrders.forEach((o, index) => {
      const tableName = o.table_id ? tableMap.get(o.table_id) || "โต๊ะทั่วไป" : "กลับบ้าน";
      const typeText = o.order_type === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน";
      const statusText =
        o.status === "completed"
          ? "ชำระเงินแล้ว"
          : o.status === "cancelled"
            ? "ยกเลิก"
            : "รอดำเนินการ";
      const itemsDetail = (o.order_items || [])
        .map((it) => `${it.menu_name} x${it.quantity}`)
        .join(" | ");

      rows.push([
        String(index + 1),
        o.order_number,
        new Date(o.created_at).toLocaleString("th-TH"),
        typeText,
        tableName,
        o.customer_name || "-",
        Number(o.total_amount || 0).toFixed(2),
        Number(o.discount_amount || 0).toFixed(2),
        Number(o.final_amount || 0).toFixed(2),
        statusText,
        itemsDetail,
      ]);
    });

    // Convert rows to CSV string with quote escaping
    const csvContent =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((field) => {
              const str = String(field ?? "").replace(/"/g, '""');
              return `"${str}"`;
            })
            .join(","),
        )
        .join("\r\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeDate = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `sales_report_${safeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print / PDF Function
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=750");
    if (!printWindow) return;

    const printDate = new Date().toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const bestSellerRowsHtml = stats.bestSellers
      .slice(0, 15)
      .map((item, index) => {
        const pct =
          stats.totalRevenue > 0 ? ((item.revenue / stats.totalRevenue) * 100).toFixed(1) : "0.0";
        return `
        <tr>
          <td style="text-align: center; font-weight: bold; color: #b91c1c;">#${index + 1}</td>
          <td>${item.name}</td>
          <td style="text-align: right;">${item.qty}</td>
          <td style="text-align: right; font-weight: 600;">฿${item.revenue.toLocaleString()}</td>
          <td style="text-align: right; color: #64748b;">${pct}%</td>
        </tr>
      `;
      })
      .join("");

    const orderRowsHtml = filteredOrders
      .map((o, idx) => {
        const tableName = o.table_id ? tableMap.get(o.table_id) || "โต๊ะทั่วไป" : "กลับบ้าน";
        const typeText = o.order_type === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน";
        const isCancelled = o.status === "cancelled";
        const timeStr = new Date(o.created_at).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const dateStr = new Date(o.created_at).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        });

        return `
        <tr style="${isCancelled ? "color: #94a3b8; text-decoration: line-through;" : ""}">
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold;">${o.order_number}</td>
          <td>${dateStr} ${timeStr}</td>
          <td>${typeText}</td>
          <td>${tableName}</td>
          <td style="text-align: right; font-weight: 600;">฿${Number(o.final_amount || 0).toLocaleString()}</td>
          <td style="text-align: center;">
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; ${
              isCancelled
                ? "background: #fee2e2; color: #991b1b;"
                : "background: #dcfce7; color: #166534;"
            }">
              ${isCancelled ? "ยกเลิก" : "สำเร็จ"}
            </span>
          </td>
        </tr>
      `;
      })
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>รายงานยอดขาย - ${storeName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1e293b;
            padding: 30px;
            background: #fff;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .title { font-size: 22px; font-weight: bold; color: #b91c1c; }
          .subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
          .meta-info { text-align: right; font-size: 12px; color: #64748b; }
          
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 8px;
            padding: 12px 14px;
          }
          .kpi-title { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
          .kpi-value { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 2px; }
          .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

          .section-title {
            font-size: 15px;
            font-weight: bold;
            color: #0f172a;
            margin: 20px 0 10px 0;
            border-left: 4px solid #b91c1c;
            padding-left: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            font-size: 12px;
          }
          th {
            background: #f1f5f9;
            color: #475569;
            text-align: left;
            padding: 8px 10px;
            border-bottom: 2px solid #cbd5e1;
            font-weight: 600;
          }
          td {
            padding: 7px 10px;
            border-bottom: 1px solid #f1f5f9;
          }
          .footer-sign {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            padding-top: 20px;
            page-break-inside: avoid;
          }
          .sign-box {
            width: 200px;
            text-align: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
            font-size: 12px;
            color: #64748b;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="background: #b91c1c; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer;">
            🖨️ กดพิมพ์หน้านี้ / บันทึก PDF
          </button>
        </div>

        <div class="header">
          <div>
            <div class="title">ร้าน${storeName} (POS)</div>
            <div class="subtitle">รายงานสรุปยอดขายและสถิติคำสั่งซื้อ</div>
            <div style="font-weight: 600; margin-top: 4px; color: #334155;">ช่วงเวลา: ${rangeLabel}</div>
          </div>
          <div class="meta-info">
            <div><strong>วันที่พิมพ์:</strong> ${printDate}</div>
            <div><strong>ผู้ออกรายงาน:</strong> ผู้จัดการร้าน (Admin)</div>
            <div><strong>สถานะ:</strong> ${includeCancelled ? "รวมบิลยกเลิก" : "เฉพาะบิลสำเร็จ"}</div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">ยอดขายสุทธิ</div>
            <div class="kpi-value" style="color: #b91c1c;">฿${stats.totalRevenue.toLocaleString()}</div>
            <div class="kpi-sub">${stats.paidCount} บิลสำเร็จ</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">ทานที่ร้าน (Dine-in)</div>
            <div class="kpi-value">฿${stats.dineInRevenue.toLocaleString()}</div>
            <div class="kpi-sub">${stats.totalRevenue > 0 ? ((stats.dineInRevenue / stats.totalRevenue) * 100).toFixed(0) : 0}% ของยอดขาย</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">สั่งกลับบ้าน (Takeaway)</div>
            <div class="kpi-value">฿${stats.takeawayRevenue.toLocaleString()}</div>
            <div class="kpi-sub">${stats.totalRevenue > 0 ? ((stats.takeawayRevenue / stats.totalRevenue) * 100).toFixed(0) : 0}% ของยอดขาย</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">ส่วนลดที่มอบให้</div>
            <div class="kpi-value">฿${stats.totalDiscount.toLocaleString()}</div>
            <div class="kpi-sub">ยกเลิก ${stats.cancelledCount} บิล</div>
          </div>
        </div>

        <div class="section-title">สรุปอันดับเมนูขายดีประจำช่วงเวลา</div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">อันดับ</th>
              <th>ชื่อเมนูอาหาร</th>
              <th style="width: 100px; text-align: right;">จำนวนจาน</th>
              <th style="width: 120px; text-align: right;">ยอดขายรวม</th>
              <th style="width: 80px; text-align: right;">สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            ${bestSellerRowsHtml || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 15px;">ไม่มีรายการขาย</td></tr>'}
          </tbody>
        </table>

        <div class="section-title">รายการบิลออเดอร์ (${filteredOrders.length} รายการ)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>เลขที่บิล</th>
              <th>เวลาสั่ง</th>
              <th>ประเภท</th>
              <th>โต๊ะ/ช่องทาง</th>
              <th style="text-align: right;">ยอดสุทธิ</th>
              <th style="text-align: center; width: 70px;">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${orderRowsHtml || '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 15px;">ไม่มีบิลออเดอร์</td></tr>'}
          </tbody>
        </table>

        <div class="footer-sign">
          <div class="sign-box">ผู้จัดทำรายงาน</div>
          <div class="sign-box">เจ้าของร้าน / ผู้มีอำนาจอนุมัติ</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 cursor-pointer shadow-xs"
          title="ออกรายงานยอดขายและสถิติร้าน"
        >
          <Download className="h-3.5 w-3.5" />
          <span>ออกรายงาน (Export)</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-4.5 w-4.5" />
            </div>
            <span>ออกรายงานยอดขาย (Sales Report)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            เลือกระยะเวลาและรูปแบบรายงานที่ต้องการดาวน์โหลดสำหรับร้าน {storeName}
          </DialogDescription>
        </DialogHeader>

        {/* Range Selection */}
        <div className="mt-2 space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>เลือกช่วงเวลาของข้อมูล:</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { key: "today", label: "วันนี้" },
                { key: "7days", label: "7 วันล่าสุด" },
                { key: "this_month", label: "เดือนนี้" },
                { key: "all", label: "ข้อมูลทั้งหมด" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRangeType(item.key as DateRangeType)}
                  className={cn(
                    "px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer text-center",
                    rangeType === item.key
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              ))}

              {/* Custom range toggle button — shows selected range as label */}
              <button
                type="button"
                onClick={() => setRangeType("custom")}
                className={cn(
                  "col-span-2 sm:col-span-1 px-2 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer text-center flex items-center justify-center gap-1 min-w-0",
                  rangeType === "custom"
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-dashed border-border bg-card text-muted-foreground hover:bg-muted hover:border-primary/50",
                )}
              >
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {rangeType === "custom" && startDate && endDate
                    ? (() => {
                        const s = startOfDayFromStr(startDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
                        const e = startOfDayFromStr(endDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
                        return `${s}–${e}`;
                      })()
                    : "กำหนดเอง"}
                </span>
              </button>
            </div>

            {/* CalendarPicker — slides in when custom is selected */}
            {rangeType === "custom" && (
              <div className="mt-3">
                <CalendarPicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartChange={setStartDate}
                  onEndChange={setEndDate}
                />
              </div>
            )}
          </div>

          {/* Filter Cancelled */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/70 text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span>รวมบิลที่ยกเลิกในรายงานด้วย</span>
            </span>
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(e) => setIncludeCancelled(e.target.checked)}
              className="h-4 w-4 rounded accent-primary cursor-pointer"
            />
          </div>

          {/* Live Data Preview Card */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">ช่วงที่เลือก: {rangeLabel}</span>
              <span className="text-muted-foreground">{filteredOrders.length} บิล</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2 rounded-lg bg-background/80 border border-border/50 text-center">
                <span className="text-[10px] text-muted-foreground block">ยอดขายสุทธิ</span>
                <span className="text-sm font-bold text-primary">{baht(stats.totalRevenue)}</span>
              </div>
              <div className="p-2 rounded-lg bg-background/80 border border-border/50 text-center">
                <span className="text-[10px] text-muted-foreground block">ทานที่ร้าน</span>
                <span className="text-xs font-semibold text-foreground">{baht(stats.dineInRevenue)}</span>
              </div>
              <div className="p-2 rounded-lg bg-background/80 border border-border/50 text-center">
                <span className="text-[10px] text-muted-foreground block">สั่งกลับบ้าน</span>
                <span className="text-xs font-semibold text-foreground">{baht(stats.takeawayRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Download CSV / Excel */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 text-xs transition-all active:scale-98 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>ดาวน์โหลด Excel (CSV)</span>
            </button>

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-4 text-xs transition-all active:scale-98 shadow-sm cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>พิมพ์รายงาน / เซฟ PDF</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
