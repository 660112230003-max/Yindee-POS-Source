import { useState, useEffect } from "react";
import { ShieldAlert, X, Delete } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ManagerOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionName?: string;
}

export function ManagerOverrideModal({
  isOpen,
  onClose,
  onSuccess,
  actionName = "การกระทำนี้",
}: ManagerOverrideModalProps) {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  // Keyboard number listener for fast PIN entry
  useEffect(() => {
    if (!isOpen) return;
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pin]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPin("");
      setIsVerifying(false);
      setShake(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleDigit(d: string) {
    if (pin.length >= 4 || isVerifying) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      verifyManagerPin(next);
    }
  }

  function handleBackspace() {
    if (isVerifying) return;
    setPin((p) => p.slice(0, -1));
  }

  async function verifyManagerPin(code: string) {
    setIsVerifying(true);
    try {
      // Allow master pin directly
      if (code === "1234") {
        toast.success("อนุมัติโดย Manager Override");
        onSuccess();
        onClose();
        return;
      }

      // Check if this pin belongs to an admin user
      const { data: users, error } = await supabase
        .from("staff_users")
        .select("role_id, roles(id)")
        .eq("pin", code)
        .eq("is_active", true);

      if (error || !users || users.length === 0) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }

      const user = users[0];
      if (user.role_id === "admin") {
        toast.success("อนุมัติโดย Manager Override");
        onSuccess();
        onClose();
      } else {
        throw new Error("รหัสผ่านนี้ไม่ใช่รหัสผู้จัดการ");
      }
    } catch (err: any) {
      setShake(true);
      toast.error(err.message || "รหัสผ่านไม่ถูกต้อง");
      setTimeout(() => {
        setShake(false);
        setPin("");
        setIsVerifying(false);
      }, 500);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div 
        className={cn(
          "w-full max-w-sm rounded-3xl border border-rose-500/30 bg-card p-6 shadow-bento-lg relative overflow-hidden transition-transform",
          shake && "animate-[shake_0.4s_ease-in-out]"
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-rose-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-500/15 text-rose-500 mb-2">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            ต้องการสิทธิ์ผู้จัดการ
          </h2>
          <p className="text-xs text-muted-foreground">
            {actionName} จำเป็นต้องใช้รหัสผ่านผู้จัดการ (Manager PIN) เพื่อยืนยัน
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex justify-center gap-3 py-2">
            {[0, 1, 2, 3].map((i) => {
              const filled = pin.length > i;
              return (
                <div
                  key={i}
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-xl border-2 text-xl font-black transition-all",
                    filled
                      ? "scale-105 border-rose-500 bg-rose-500/15 text-rose-600"
                      : "border-border bg-muted/30 text-muted-foreground"
                  )}
                >
                  {filled ? "•" : ""}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                disabled={isVerifying}
                className="h-12 rounded-2xl border border-border bg-card text-lg font-bold transition-all hover:bg-rose-500/10 hover:text-rose-600 active:scale-95 disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if(!isVerifying) setPin("");
              }}
              disabled={isVerifying}
              className="h-12 rounded-2xl border border-border bg-muted/20 text-xs font-semibold text-muted-foreground hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              รีเซ็ต
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              disabled={isVerifying}
              className="h-12 rounded-2xl border border-border bg-card text-lg font-bold transition-all hover:bg-rose-500/10 hover:text-rose-600 active:scale-95 disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isVerifying}
              className="grid h-12 place-items-center rounded-2xl border border-border bg-muted/20 text-muted-foreground hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
