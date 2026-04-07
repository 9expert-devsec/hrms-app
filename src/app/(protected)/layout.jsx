// src/app/(protected)/layout.jsx
import Sidebar from "./../../components/Sidebar";
import Topbar from "./../../components/Topbar";

export default function ProtectedLayout({ children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100dvh",
        overflow: "hidden",
        background: "#F8FAFD",
        color: "#0D1B2A",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Topbar />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "24px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
