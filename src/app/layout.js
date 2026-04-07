import "./globals.css";
import Providers from "./providers";
import HeaderGate from "./../components/HeaderGate";
import ScrollTopButton from "./../components/ScrollTopButton";

export const metadata = {
  title: "9Expert HRMS",
  description: "Internal Human Resource Management System — 9Expert Training",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        className="antialiased"
        style={{ background: "#F8FAFD", color: "#0D1B2A" }}
      >
        <Providers>
          {/* <HeaderGate /> */}
          <main className="min-h-[calc(100dvh-4rem)]">{children}</main>
        </Providers>
        <ScrollTopButton />
      </body>
    </html>
  );
}