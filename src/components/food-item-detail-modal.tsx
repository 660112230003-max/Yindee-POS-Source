import React, { useState, useEffect, useMemo } from "react";
import { X, Check, Minus, Plus } from "lucide-react";

export interface PortionOption {
  id: string;
  name: string;
  extraPrice: number;
}

export interface SpiceOption {
  id: string;
  name: string;
  extraPrice: number;
}

export interface AddOnOption {
  id: string;
  name: string;
  price: number;
}

export interface FoodItemData {
  id?: string;
  code?: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string | null;
  spiceOptions?: SpiceOption[];
  addOnOptions?: AddOnOption[];
}

export interface FoodItemSelection {
  itemId?: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  selectedPortion: PortionOption;
  selectedSpice: SpiceOption;
  selectedAddOns: AddOnOption[];
  note: string;
  summaryText: string;
}

export interface FoodItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: FoodItemData | null;
  isNoteOnly?: boolean;
  portionOptions?: PortionOption[];
  spiceOptions?: SpiceOption[];
  addOnOptions?: AddOnOption[];
  defaultPortionId?: string;
  defaultSpiceId?: string;
  initialQuantity?: number;
  onAddToCart?: (selection: FoodItemSelection) => void;
  title?: string;
  primaryColor?: string;
}

export const DEFAULT_FOOD_ITEM: FoodItemData = {
  id: "pad-kra-pao-01",
  code: "M001",
  name: "ข้าวหมูกรอบ",
  price: 70,
  description: "ข้าวหมูกรอบหอมกรอบ รสกลมกล่อม",
  image_url: "/images/thai-food-hero.jpg",
};

export const DEFAULT_PORTION_OPTIONS: PortionOption[] = [
  { id: "portion-regular", name: "ธรรมดา", extraPrice: 0 },
  { id: "portion-special", name: "พิเศษ", extraPrice: 10 },
];

export const DEFAULT_SPICE_OPTIONS: SpiceOption[] = [
  { id: "spice-none", name: "ไม่เผ็ด", extraPrice: 0 },
  { id: "spice-normal", name: "เผ็ดปกติ", extraPrice: 0 },
  { id: "spice-hot", name: "เผ็ดมาก", extraPrice: 0 },
];

export const DEFAULT_ADDON_OPTIONS: AddOnOption[] = [
  { id: "addon-boiled-egg", name: "ไข่ต้มยางมะตูม", price: 15 },
  { id: "addon-steamed-rice", name: "ข้าวสวย", price: 10 },
  { id: "addon-crispy-pork", name: "เพิ่มหมูกรอบ", price: 25 },
];

export const KAB_KHAO_ADDON_OPTIONS: AddOnOption[] = [
  { id: "addon-boiled-egg", name: "ไข่ต้มยางมะตูม", price: 15 },
  { id: "addon-steamed-rice", name: "ข้าวสวย", price: 10 },
];

/**
 * ตรวจสอบว่าเมนูนี้เป็นเมนูในหมวด "กับข้าว" หรือไม่
 */
export function isKabKhaoItem(item?: { id?: string; code?: string; name?: string; category_id?: string | null } | null): boolean {
  if (!item) return false;
  const rawCode = (item.code || "").replace(/\s+/g, "").toUpperCase();
  const rawId = (item.id || "").replace(/\s+/g, "").toLowerCase();
  const name = item.name || "";
  const catId = ((item as { category_id?: string | null }).category_id || "").toLowerCase();

  // หมวดกับข้าว เช่น M009, M010, M0011 หรือ category กับข้าว
  if (
    rawCode === "M009" ||
    rawCode === "M010" ||
    rawCode === "M0011" ||
    rawCode === "M011" ||
    rawCode === "M9" ||
    rawCode === "M10" ||
    rawCode === "M11" ||
    rawId === "m009" ||
    rawId === "m010" ||
    rawId === "m0011" ||
    rawId === "m011" ||
    rawId === "49a8c851-4854-4af7-bb05-5127d2e8650e" || // M009 หมูกรอบจานใหญ่
    rawId === "3cf41c82-7d61-4f57-94f5-93b396a8a203" || // M010 หมูแดงจานใหญ่
    rawId === "58a1be1f-d5e4-47bd-b492-dd166c9e3de2" || // M0011 หมูกรอบผสมหมูแดง
    catId === "99fbb89e-e8f7-49ca-b622-542b30b3627a" || // กับข้าว category
    catId === "c3" ||
    catId === "cat_dish" ||
    name.includes("จานใหญ่") ||
    name.includes("หมูกรอบผสมหมูแดง")
  ) {
    return true;
  }
  return false;
}

/**
 * ตรวจสอบว่าเมนูนี้มีตัวเลือกระดับความเผ็ดหรือไม่
 * เงื่อนไข: เฉพาะเมนู M005 (ผัดไทยหมูกรอบ) และ M008 (สุกี้แห้งหมูกรอบ) เท่านั้นที่มีตัวเลือกระดับความเผ็ด นอกนั้นไม่มี
 */
export function hasSpiceOption(item?: { id?: string; code?: string; name?: string } | null): boolean {
  if (!item) return false;
  const rawCode = (item.code || "").replace(/\s+/g, "").toUpperCase();
  const rawId = (item.id || "").replace(/\s+/g, "").toLowerCase();
  const name = item.name || "";

  // เมนู M005 / M5 (ผัดไทย)
  if (
    rawCode === "M005" ||
    rawCode === "M5" ||
    rawCode === "M05" ||
    rawId === "m005" ||
    rawId === "m5" ||
    rawId === "d819bc46-f371-49ca-b500-2e41adc0eda6" ||
    name.includes("ผัดไทย")
  ) {
    return true;
  }

  // เมนู M008 / M8 (สุกี้แห้ง)
  if (
    rawCode === "M008" ||
    rawCode === "M8" ||
    rawCode === "M08" ||
    rawId === "m008" ||
    rawId === "m8" ||
    rawId === "2383717e-3122-4262-be36-717f062b8ee2" ||
    name.includes("สุกี้")
  ) {
    return true;
  }

  return false;
}

export function FoodItemDetailModal({
  isOpen,
  onClose,
  item = DEFAULT_FOOD_ITEM,
  isNoteOnly = false,
  portionOptions = DEFAULT_PORTION_OPTIONS,
  spiceOptions = DEFAULT_SPICE_OPTIONS,
  addOnOptions = DEFAULT_ADDON_OPTIONS,
  defaultPortionId,
  defaultSpiceId,
  initialQuantity = 1,
  onAddToCart,
  title = "รายละเอียดเมนู",
  primaryColor,
}: FoodItemDetailModalProps) {
  const currentItem = item || DEFAULT_FOOD_ITEM;
  const themeColor = primaryColor || "#F97316";
  const isKabKhao = isKabKhaoItem(currentItem);
  const showPortionOption = !isNoteOnly && !isKabKhao;
  const showSpiceOption = !isNoteOnly && !isKabKhao && hasSpiceOption(currentItem);

  const effectivePortionOptions = useMemo(() => {
    return portionOptions || DEFAULT_PORTION_OPTIONS;
  }, [portionOptions]);

  const effectiveSpiceOptions = useMemo(() => {
    if (currentItem.spiceOptions && currentItem.spiceOptions.length > 0) {
      return currentItem.spiceOptions;
    }
    return spiceOptions || DEFAULT_SPICE_OPTIONS;
  }, [currentItem, spiceOptions]);

  const effectiveAddOnOptions = useMemo(() => {
    if (currentItem.addOnOptions && currentItem.addOnOptions.length > 0) {
      return currentItem.addOnOptions;
    }
    if (addOnOptions && addOnOptions !== DEFAULT_ADDON_OPTIONS) {
      return addOnOptions;
    }
    return isKabKhao ? KAB_KHAO_ADDON_OPTIONS : DEFAULT_ADDON_OPTIONS;
  }, [currentItem, addOnOptions, isKabKhao]);

  const sectionSpiceTitle = "ระดับความเผ็ด";

  // Selected portion (ธรรมดา / พิเศษ)
  const [selectedPortionId, setSelectedPortionId] = useState<string>(() => {
    if (defaultPortionId) return defaultPortionId;
    return effectivePortionOptions?.[0]?.id || "portion-regular";
  });

  // Selected single option level (Spice option)
  const [selectedSpiceId, setSelectedSpiceId] = useState<string>(() => {
    if (defaultSpiceId) return defaultSpiceId;
    return effectiveSpiceOptions?.[0]?.id || "";
  });

  // Selected add-ons (Multi selection)
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  // Special instructions
  const [note, setNote] = useState<string>("");

  // Quantity stepper
  const [quantity, setQuantity] = useState<number>(initialQuantity);

  // Reset state whenever modal opens with a new item
  useEffect(() => {
    if (isOpen) {
      const initialPortionId = defaultPortionId || effectivePortionOptions?.[0]?.id || "portion-regular";
      const initialSpiceId = defaultSpiceId || effectiveSpiceOptions?.[0]?.id || "";
      setSelectedPortionId(initialPortionId);
      setSelectedSpiceId(initialSpiceId);
      setSelectedAddOnIds([]);
      setNote("");
      setQuantity(Math.max(1, initialQuantity || 1));
    }
  }, [isOpen, currentItem?.name, currentItem?.code, defaultPortionId, effectivePortionOptions, defaultSpiceId, effectiveSpiceOptions, initialQuantity]);

  // Lock body scroll on mobile/desktop when modal is open
  useEffect(() => {
    if (isOpen && typeof document !== "undefined") {
      const originalStyle = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Close on ESC key
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Calculations
  const activePortion = useMemo(
    () => {
      if (isNoteOnly || !showPortionOption) return DEFAULT_PORTION_OPTIONS[0];
      return (
        (effectivePortionOptions || []).find((p) => p.id === selectedPortionId) ||
        (effectivePortionOptions || [])[0]
      );
    },
    [isNoteOnly, showPortionOption, effectivePortionOptions, selectedPortionId],
  );

  const activeSpice = useMemo(
    () => {
      if (isNoteOnly || !showSpiceOption) return DEFAULT_SPICE_OPTIONS[0];
      return (
        (effectiveSpiceOptions || []).find((s) => s.id === selectedSpiceId) ||
        (effectiveSpiceOptions || [])[0]
      );
    },
    [isNoteOnly, showSpiceOption, effectiveSpiceOptions, selectedSpiceId],
  );

  const activeAddOns = useMemo(
    () => {
      if (isNoteOnly) return [];
      return (effectiveAddOnOptions || []).filter((a) => selectedAddOnIds.includes(a.id));
    },
    [isNoteOnly, effectiveAddOnOptions, selectedAddOnIds],
  );

  const addOnsTotal = useMemo(
    () => activeAddOns.reduce((sum, a) => sum + (Number(a.price) || 0), 0),
    [activeAddOns],
  );

  const basePrice = Number(currentItem?.price) || 0;
  const portionExtraTotal = isNoteOnly || !showPortionOption ? 0 : Number(activePortion?.extraPrice) || 0;
  const spiceExtraTotal = isNoteOnly || !showSpiceOption ? 0 : Number(activeSpice?.extraPrice) || 0;
  const unitPrice = isNoteOnly ? basePrice : basePrice + portionExtraTotal + spiceExtraTotal + addOnsTotal;
  const calculatedTotalPrice = unitPrice * Math.max(1, quantity);

  // Format currency display (e.g., ฿85.00)
  const formatPrice = (amount: number | string | undefined | null) => {
    const num = Number(amount);
    const validAmount = !isNaN(num) ? num : 0;
    return `฿${validAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleDecreaseQty = () => {
    if (quantity > 1) {
      setQuantity((q) => q - 1);
    }
  };

  const handleIncreaseQty = () => {
    setQuantity((q) => q + 1);
  };

  const handleAddToCart = () => {
    let summaryText = "";

    if (isNoteOnly) {
      summaryText = note.trim() ? `โน้ต: ${note.trim()}` : "";
    } else {
      const portionName = showPortionOption ? (activePortion?.name || "ธรรมดา") : null;
      const spiceName = showSpiceOption && activeSpice ? activeSpice.name : "";
      const addOnNames = activeAddOns.map((a) => a.name).join(", ");

      const parts = [
        portionName,
        spiceName ? `เผ็ด: ${spiceName}` : null,
        addOnNames ? `เพิ่ม: ${addOnNames}` : null,
        note.trim() ? `โน้ต: ${note.trim()}` : null,
      ].filter(Boolean);

      summaryText = parts.length > 0 ? parts.join(" | ") : "";
    }

    const selection: FoodItemSelection = {
      itemId: currentItem.id,
      name: currentItem.name,
      basePrice: currentItem.price,
      unitPrice,
      totalPrice: calculatedTotalPrice,
      quantity,
      selectedPortion: showPortionOption ? activePortion : { id: "none", name: "", extraPrice: 0 },
      selectedSpice: showSpiceOption
        ? (activeSpice || { id: "none", name: "ปกติ", extraPrice: 0 })
        : { id: "none", name: "", extraPrice: 0 },
      selectedAddOns: isNoteOnly ? [] : activeAddOns,
      note: note.trim(),
      summaryText,
    };

    onAddToCart?.(selection);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-item-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
    >
      {/* Dark overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal / Bottom Sheet Container */}
      <div
        className="relative z-10 w-full sm:max-w-[480px] md:max-w-[500px] bg-[#FAF7F2] text-[#2D2424] rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-[#EBE5DF] flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="pt-2 sm:hidden flex justify-center">
          <div className="w-12 h-1.5 bg-[#DDD6CE] rounded-full" />
        </div>

        {/* 1. Header */}
        <header className="px-5 sm:px-6 pt-3 pb-3 flex items-center justify-between border-b border-[#EBE5DF]/60 bg-[#FAF7F2] shrink-0">
          <h2
            id="food-item-modal-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-[#2D2424]"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="w-10 h-10 rounded-2xl bg-white border border-[#E8E2DA] flex items-center justify-center text-[#7A716E] hover:text-[#2D2424] hover:bg-white hover:border-[#DDD6CE] active:scale-95 transition-all shadow-xs"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-6 overscroll-contain">
          {/* 2. Food Hero Section */}
          <section className="space-y-3">
            {/* Hero Image */}
            <div className="w-full aspect-[16/10] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#ECE6DE] shadow-sm relative">
              <img
                src={currentItem.image_url || "/images/thai-food-hero.jpg"}
                alt={currentItem.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/images/thai-food-hero.jpg";
                }}
              />
            </div>

            {/* Title & Price Row */}
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <h3 className="text-2xl font-bold text-[#2D2424] tracking-tight">
                {currentItem.name}
              </h3>
              <span className="text-2xl font-bold shrink-0" style={{ color: themeColor }}>
                {formatPrice(currentItem.price)}
              </span>
            </div>

            {/* Short Description */}
            {currentItem.description && (
              <p className="text-sm text-[#7A716E] leading-relaxed">
                {currentItem.description}
              </p>
            )}
          </section>

          {/* Options Sections: ขนาด, ระดับความเผ็ด, เพิ่มความอร่อย (ซ่อนเมื่อเป็นเมนูที่มีแค่หมายเหตุ เช่น กับข้าว และ น้ำ) */}
          {!isNoteOnly && (
            <>
              {/* Option Section: Portion / Size Selection (ธรรมดา / พิเศษ) - แสดงเฉพาะอาหารจานเดียว */}
              {showPortionOption && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-[#2D2424]">ขนาด</h4>
                    <span className="text-xs font-semibold" style={{ color: themeColor }}>
                      จำเป็นต้องเลือก
                    </span>
                  </div>

                  <div className="space-y-2" role="radiogroup" aria-label="ขนาด">
                    {effectivePortionOptions.map((opt) => {
                      const isSelected = selectedPortionId === opt.id;
                      return (
                        <label
                          key={opt.id}
                          onClick={() => setSelectedPortionId(opt.id)}
                          style={
                            isSelected
                              ? { borderColor: themeColor, boxShadow: `0 0 0 1.5px ${themeColor}33` }
                              : undefined
                          }
                          className={`w-full rounded-2xl bg-white border p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-all duration-150 select-none ${
                            isSelected
                              ? "shadow-xs"
                              : "border-[#E8E2DA] hover:border-[#DDD6CE]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Radio Circle */}
                            <div
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                              style={{ borderColor: isSelected ? themeColor : "#C9C2BA" }}
                            >
                              {isSelected && (
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColor }} />
                              )}
                            </div>
                            <span className="text-[15px] font-medium text-[#2D2424]">
                              {opt.name}
                            </span>
                          </div>

                          <span className="text-sm text-[#8E8785]">
                            {opt.extraPrice > 0
                              ? `+${formatPrice(opt.extraPrice)}`
                              : "ไม่เพิ่มราคา"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Option Section: Single Selection (Radio List - ระดับความเผ็ด) - เฉพาะเมนู M005 และ M008 */}
              {showSpiceOption && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-[#2D2424]">{sectionSpiceTitle}</h4>
                    <span className="text-xs font-semibold" style={{ color: themeColor }}>
                      จำเป็นต้องเลือก
                    </span>
                  </div>

                  <div className="space-y-2" role="radiogroup" aria-label={sectionSpiceTitle}>
                    {effectiveSpiceOptions.map((opt) => {
                      const isSelected = selectedSpiceId === opt.id;
                      return (
                        <label
                          key={opt.id}
                          onClick={() => setSelectedSpiceId(opt.id)}
                          style={
                            isSelected
                              ? { borderColor: themeColor, boxShadow: `0 0 0 1.5px ${themeColor}33` }
                              : undefined
                          }
                          className={`w-full rounded-2xl bg-white border p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-all duration-150 select-none ${
                            isSelected
                              ? "shadow-xs"
                              : "border-[#E8E2DA] hover:border-[#DDD6CE]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Radio Circle */}
                            <div
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                              style={{ borderColor: isSelected ? themeColor : "#C9C2BA" }}
                            >
                              {isSelected && (
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColor }} />
                              )}
                            </div>
                            <span className="text-[15px] font-medium text-[#2D2424]">
                              {opt.name}
                            </span>
                          </div>

                          <span className="text-sm text-[#8E8785]">
                            {opt.extraPrice > 0
                              ? `+${formatPrice(opt.extraPrice)}`
                              : "ไม่เพิ่มราคา"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Option Section: Multi-Selection (Checkbox List - เพิ่มความอร่อย) */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-[#2D2424]">เพิ่มความอร่อย</h4>
                  <span className="text-xs font-normal text-[#7A716E]">
                    เลือกได้หลายรายการ
                  </span>
                </div>

                <div className="space-y-2">
                  {effectiveAddOnOptions.map((opt) => {
                    const isChecked = selectedAddOnIds.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        onClick={() => toggleAddOn(opt.id)}
                        style={
                          isChecked
                            ? { borderColor: themeColor, boxShadow: `0 0 0 1.5px ${themeColor}26` }
                            : undefined
                        }
                        className={`w-full rounded-2xl bg-white border p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-all duration-150 select-none ${
                          isChecked
                            ? "shadow-xs"
                            : "border-[#E8E2DA] hover:border-[#DDD6CE]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkbox Square */}
                          <div
                            className="w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors"
                            style={
                              isChecked
                                ? { backgroundColor: themeColor, borderColor: themeColor, color: "#ffffff" }
                                : { borderColor: "#C9C2BA", backgroundColor: "#ffffff" }
                            }
                          >
                            {isChecked && (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                          </div>
                          <span className="text-[15px] font-medium text-[#2D2424]">
                            {opt.name}
                          </span>
                        </div>

                        <span className="text-sm font-medium text-[#7A716E]">
                          +{formatPrice(opt.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* Special Instructions (Textarea - หมายเหตุถึงครัว) */}
          <section className="space-y-2">
            <h4 className="text-base font-bold text-[#2D2424]">หมายเหตุถึงครัว</h4>
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  (currentItem.name || "").includes("ชา") ||
                  (currentItem.name || "").includes("น้ำ") ||
                  (currentItem.name || "").includes("กาแฟ") ||
                  (currentItem.name || "").includes("โซดา") ||
                  (currentItem.name || "").includes("โค้ก")
                    ? "เช่น หวานน้อย, แยกน้ำแข็ง, หวาน 50%"
                    : "เช่น ไม่ใส่ผักชี, ไม่ใส่ชูรส, แยกน้ำ"
                }
                rows={3}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = themeColor;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${themeColor}26`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E8E2DA";
                  e.currentTarget.style.boxShadow = "none";
                }}
                className="w-full rounded-2xl bg-white border border-[#E8E2DA] p-3.5 text-sm text-[#2D2424] placeholder:text-[#A09895] focus:outline-none transition resize-none leading-relaxed"
              />
            </div>
          </section>

          {/* 7. Quantity Counter (จำนวน) */}
          <section className="flex items-center justify-between pt-1">
            <h4 className="text-base font-bold text-[#2D2424]">จำนวน</h4>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecreaseQty}
                disabled={quantity <= 1}
                aria-label="ลดจำนวน"
                className="w-11 h-11 rounded-2xl bg-white border border-[#E8E2DA] flex items-center justify-center text-[#2D2424] hover:bg-stone-50 active:scale-95 transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Minus className="w-4 h-4 stroke-[2.5]" />
              </button>

              <span className="w-10 text-center font-bold text-lg text-[#2D2424] select-none">
                {quantity}
              </span>

              <button
                type="button"
                onClick={handleIncreaseQty}
                aria-label="เพิ่มจำนวน"
                className="w-11 h-11 rounded-2xl bg-white border border-[#E8E2DA] flex items-center justify-center text-[#2D2424] hover:bg-stone-50 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </section>
        </div>

        {/* Sticky / Bottom Fixed CTA Button */}
        <footer className="p-4 sm:p-5 bg-[#FAF7F2] border-t border-[#EBE5DF]/80 shrink-0">
          <button
            type="button"
            onClick={handleAddToCart}
            style={{
              backgroundColor: themeColor,
              boxShadow: `0 10px 25px -5px ${themeColor}55`,
            }}
            className="w-full h-13.5 sm:h-14 hover:brightness-105 active:scale-[0.99] text-white font-bold text-base sm:text-lg rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            เพิ่มลงตะกร้า · {formatPrice(calculatedTotalPrice)}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default FoodItemDetailModal;
