// Shown next to a head of department who has no login account (no userId):
// they can be assigned, but cannot approve anything in the system.
export default function NoAccountBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 ${className}`}
      style={{
        background: "#FEE2E2",
        color: "#991B1B",
        border: "1px solid #FECACA",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      ยังไม่มีบัญชีผู้ใช้ — อนุมัติในระบบไม่ได้
    </span>
  );
}
