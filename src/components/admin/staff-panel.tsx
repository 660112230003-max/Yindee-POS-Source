import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, User, Lock, Check, Shield } from "lucide-react";
import { toast } from "sonner";

import { PanelShell, bento } from "@/components/console-layout";
import { Modal, Labeled } from "@/components/modal";
import {
  db,
  fetchStaffUsers,
  deleteStaffUser,
  type StaffUser,
} from "@/lib/restaurant";
import { ROLES_CONFIG, sha256Hex, type StaffRole } from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

const EMPTY: Omit<StaffUser, "id" | "created_at"> = {
  name: "",
  username: "",
  password: "",
  role_id: "staff",
  is_active: true,
};

export function StaffPanel() {
  const qc = useQueryClient();
  const { data: staff = [] } = useQuery({ queryKey: ["staff_users"], queryFn: fetchStaffUsers });
  const [draft, setDraft] = useState<(Omit<StaffUser, "id" | "created_at"> & { id?: string }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState<StaffUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff_users"] });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("กรุณากรอกชื่อพนักงาน");
      return;
    }
    if (!draft.role_id) {
      toast.error("กรุณาเลือกบทบาท");
      return;
    }

    setIsSaving(true);
    const { id, ...payload } = draft;
    const targetId = id || crypto.randomUUID();

    // Clean up empty password when editing existing user
    const updatePayload: any = { ...payload };
    if (id && !updatePayload.password) {
      delete updatePayload.password;
    }

    // Ensure PIN has a safe fallback for DB column NOT NULL constraint
    updatePayload.pin = updatePayload.pin || updatePayload.password || "1234";

    const fullStaffData: StaffUser = {
      id: targetId,
      name: draft.name.trim(),
      username: draft.username?.trim() || null,
      password: draft.password || null,
      pin: updatePayload.pin,
      role_id: draft.role_id,
      is_active: draft.is_active,
      created_at: new Date().toISOString(),
    };

    // 1. Immediately save to local persistent cache so user's edit is NEVER lost
    try {
      const raw = localStorage.getItem("pos_local_staff_cache");
      const cache: Record<string, Partial<StaffUser>> = raw ? JSON.parse(raw) : {};
      const existing = cache[targetId] || {};
      cache[targetId] = {
        ...existing,
        ...fullStaffData,
        // preserve password if not updated
        password: draft.password || existing.password || null,
      };
      localStorage.setItem("pos_local_staff_cache", JSON.stringify(cache));
    } catch (cacheErr) {
      console.warn("Local storage cache save error:", cacheErr);
    }

    let savedToDb = false;

    // 2. Save to Supabase staff_users table with .select()
    try {
      let res = id
        ? await db.from("staff_users").update(updatePayload).eq("id", id).select()
        : await db.from("staff_users").insert({ id: targetId, ...updatePayload }).select();

      if (!res.error && res.data && res.data.length > 0) {
        savedToDb = true;
      } else if (
        res.error &&
        (res.error.message.includes("username") || res.error.message.includes("password"))
      ) {
        // Fallback if username/password columns are not yet added in DB
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.username;
        delete fallbackPayload.password;

        const retry = id
          ? await db.from("staff_users").update(fallbackPayload).eq("id", id).select()
          : await db.from("staff_users").insert({ id: targetId, ...fallbackPayload }).select();

        if (!retry.error && retry.data && retry.data.length > 0) {
          savedToDb = true;
        }
      }
    } catch (e) {
      console.warn("Update staff_users error:", e);
    }

    // 3. Also sync to staff_members if corresponding record exists or matches name
    try {
      const memPayload: any = {
        name: draft.name.trim(),
        role: draft.role_id,
        is_active: draft.is_active,
      };
      if (draft.password) {
        memPayload.pin_hash = await sha256Hex(draft.password);
      }

      if (id) {
        const memRes = await db.from("staff_members").update(memPayload).eq("id", id).select();
        if (!memRes.error && memRes.data && memRes.data.length > 0) {
          savedToDb = true;
        }
      }
    } catch (mErr) {
      console.warn("Update staff_members error:", mErr);
    }

    setIsSaving(false);
    toast.success(id ? "บันทึกการแก้ไขข้อมูลพนักงานสำเร็จ" : "เพิ่มพนักงานใหม่สำเร็จ");
    setDraft(null);
    refresh();
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await deleteStaffUser(toDelete.id, toDelete.name);
      toast.success(`ลบพนักงาน "${toDelete.name}" สำเร็จ`);
      setToDelete(null);
      if (draft && draft.id === toDelete.id) {
        setDraft(null);
      }
      refresh();
    } catch (e: any) {
      toast.error("ลบข้อมูลไม่สำเร็จ: " + (e?.message || "เกิดข้อผิดพลาด"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PanelShell
      title="บัญชีพนักงาน"
      actions={
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> เพิ่มพนักงาน
        </button>
      }
    >
      <div className={cn(bento, "overflow-x-auto")}>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">ชื่อพนักงาน</th>
              <th className="p-3">ชื่อผู้ใช้ (Username)</th>
              <th className="p-3">บทบาท</th>
              <th className="p-3">รหัสผ่าน</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const roleInfo = ROLES_CONFIG[s.role_id] || { title: s.role_id };

              return (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-bold text-foreground">{s.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {s.username ? (
                      <span className="font-semibold text-foreground">@{s.username}</span>
                    ) : (
                      <span className="text-muted-foreground/60">-</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{roleInfo.title.split(" ")[0]}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {s.password ? "••••••••" : "รหัสเริ่มต้น"}
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        s.is_active
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {s.is_active ? "✔️ ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() =>
                          setDraft({
                            ...s,
                            username: s.username || "",
                            password: "",
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> แก้ไข
                      </button>
                      <button
                        onClick={() => setToDelete(s)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-destructive/80 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="ลบพนักงาน"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  ไม่พบข้อมูลพนักงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Modal */}
      {draft && (
        <Modal title={draft.id ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มข้อมูลพนักงาน"} onClose={() => setDraft(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 1. ชื่อพนักงาน */}
            <Labeled label="ชื่อพนักงาน">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="input-base"
                placeholder="เช่น ผู้จัดการร้าน หรือ สมหญิง"
              />
            </Labeled>

            {/* 2. บทบาท */}
            <Labeled label="บทบาท">
              <select
                value={draft.role_id}
                onChange={(e) => setDraft({ ...draft, role_id: e.target.value as StaffRole })}
                className="input-base"
              >
                {Object.values(ROLES_CONFIG).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.title}
                  </option>
                ))}
              </select>
            </Labeled>

            {/* 3. Username */}
            <Labeled label="ชื่อผู้ใช้งาน (Username)">
              <div className="relative">
                <input
                  type="text"
                  value={draft.username || ""}
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  className="input-base"
                  placeholder="เช่น admin, cashier1, somchai"
                />
              </div>
            </Labeled>

            {/* 4. Password */}
            <Labeled label={draft.id ? "รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)" : "รหัสผ่าน (Password)"}>
              <input
                type="password"
                value={draft.password || ""}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className="input-base"
                placeholder="รหัสผ่านสำหรับเข้าสู่ระบบ"
              />
            </Labeled>

            {/* 5. สถานะ */}
            <Labeled label="สถานะการใช้งาน">
              <select
                value={draft.is_active ? "true" : "false"}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.value === "true" })}
                className="input-base"
              >
                <option value="true">ใช้งาน</option>
                <option value="false">ปิดใช้งาน</option>
              </select>
            </Labeled>

            <div className="sm:col-span-2 mt-2 flex items-center justify-between gap-3">
              {draft.id && (
                <button
                  type="button"
                  onClick={() => {
                    const target = { ...draft } as StaffUser;
                    setDraft(null);
                    setToDelete(target);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> ลบพนักงานนี้
                </button>
              )}

              <button
                disabled={isSaving}
                onClick={save}
                className={cn(
                  "rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50",
                  draft.id ? "flex-1" : "w-full"
                )}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {toDelete && (
        <Modal title="ยืนยันการลบข้อมูลพนักงาน" onClose={() => setToDelete(null)}>
          <div className="space-y-4">
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-sm text-destructive">
              คุณต้องการลบพนักงาน <strong>"{toDelete.name}"</strong> ใช่หรือไม่?
            </div>
            <p className="text-xs text-muted-foreground">
              เมื่อลบแล้ว บัญชีนี้จะถูกนำออกจากระบบทันที และไม่สามารถใช้เข้าสู่ระบบได้อีก
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "กำลังลบ..." : "ยืนยันการลบ"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PanelShell>
  );
}

