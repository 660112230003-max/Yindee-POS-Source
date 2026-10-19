import { createFileRoute, Navigate } from "@tanstack/react-router";
import { StaffGuard } from "@/lib/staff-auth";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "สถานะคำสั่งซื้อ · Restaurant OS" },
      { name: "description", content: "ติดตามสถานะคำสั่งซื้อและสถานะห้องครัว" },
    ],
  }),
  component: StatusPage,
});

function StatusPage() {
  return (
    <StaffGuard pageTitle="สถานะคำสั่งซื้อ & ห้องครัว">
      <Navigate to="/order-status" replace />
    </StaffGuard>
  );
}
